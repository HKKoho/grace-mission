import { randomUUID } from 'node:crypto';
import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import mqtt, { type MqttClient } from 'mqtt';
import { createLogger } from '@clawix/shared';

const logger = createLogger('mqtt:client');

const RECONNECT_PERIOD_MS = 5_000;
const CONNECT_TIMEOUT_MS = 10_000;
const END_TIMEOUT_MS = 3_000;

function presenceTopic(instanceId: string): string {
  return `clawix/${instanceId}/presence`;
}

/**
 * Thin wrapper around a single mqtt.js connection, scoped to this Clawix
 * instance — one connection per instance, shared by presence, notification
 * fan-out, and the mqtt federation ChannelAdapter (mqtt.adapter.ts), rather
 * than each opening its own. No-ops entirely when MQTT_BROKER_URL is unset
 * so MQTT stays opt-in. See docs/MQTT.md.
 */
@Injectable()
export class MqttClientService implements OnModuleInit, OnModuleDestroy {
  private client: MqttClient | null = null;
  private _instanceId: string | null = null;
  private readonly subscriptions = new Map<string, (payload: unknown) => void>();

  constructor(private readonly config: ConfigService) {}

  get instanceId(): string | null {
    return this._instanceId;
  }

  get isConnected(): boolean {
    return this.client?.connected ?? false;
  }

  onModuleInit(): void {
    const brokerUrl = this.config.get<string>('MQTT_BROKER_URL');
    if (!brokerUrl) {
      logger.info('MQTT_BROKER_URL not set — MQTT disabled');
      return;
    }

    const instanceId = this.resolveInstanceId();
    this._instanceId = instanceId;
    const username = this.config.get<string>('MQTT_USERNAME') ?? instanceId;
    const password = this.config.get<string>('MQTT_PASSWORD');

    logger.info({ brokerUrl, instanceId }, 'Connecting to MQTT broker');

    const client = mqtt.connect(brokerUrl, {
      clientId: `clawix-${instanceId}`,
      username,
      password,
      reconnectPeriod: RECONNECT_PERIOD_MS,
      connectTimeout: CONNECT_TIMEOUT_MS,
      will: {
        topic: presenceTopic(instanceId),
        payload: JSON.stringify({ status: 'offline', instanceId }),
        qos: 1,
        retain: true,
      },
    });
    this.client = client;

    client.on('connect', () => {
      logger.info({ instanceId }, 'MQTT connected');
      this.publishPresence('online');
      this.resubscribeAll();
    });
    client.on('reconnect', () => {
      logger.warn({ instanceId }, 'MQTT reconnecting');
    });
    client.on('close', () => {
      logger.warn({ instanceId }, 'MQTT connection closed');
    });
    client.on('error', (err: Error) => {
      logger.error({ instanceId, err: err.message }, 'MQTT client error');
    });
    client.on('message', (topic: string, payload: Buffer) => {
      const handler = this.subscriptions.get(topic);
      if (!handler) return;
      try {
        handler(JSON.parse(payload.toString()));
      } catch {
        logger.warn({ topic }, 'MQTT message payload was not valid JSON, dropping');
      }
    });
  }

  async onModuleDestroy(): Promise<void> {
    const client = this.client;
    if (!client) return;

    if (client.connected) {
      await this.publishPresenceAsync('offline');
    }

    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, END_TIMEOUT_MS);
      client.end(false, {}, () => {
        clearTimeout(timer);
        resolve();
      });
    });
    this.client = null;
  }

  /** Publish a JSON payload to `topic`. Best-effort: no-ops if not connected. */
  publish(topic: string, payload: unknown, opts?: { retain?: boolean }): void {
    if (!this.client?.connected) {
      logger.debug({ topic }, 'MQTT publish skipped — not connected');
      return;
    }
    this.client.publish(
      topic,
      JSON.stringify(payload),
      { qos: 1, retain: opts?.retain ?? false },
      (err) => {
        if (err) logger.warn({ topic, err: err.message }, 'MQTT publish failed');
      },
    );
  }

  /**
   * Subscribe to `topic`, parsing each incoming payload as JSON before
   * calling `handler`. Best-effort: stores the subscription regardless of
   * connection state and (re-)issues it to the broker on every `connect`
   * event, so it survives reconnects. One handler per exact topic string —
   * no wildcard dispatch.
   */
  subscribe(topic: string, handler: (payload: unknown) => void): void {
    this.subscriptions.set(topic, handler);
    if (this.client?.connected) {
      this.client.subscribe(topic, { qos: 1 }, (err) => {
        if (err) logger.warn({ topic, err: err.message }, 'MQTT subscribe failed');
      });
    }
  }

  /** Stop listening on `topic`. No-ops if never subscribed or not connected. */
  unsubscribe(topic: string): void {
    this.subscriptions.delete(topic);
    if (this.client?.connected) {
      this.client.unsubscribe(topic, (err) => {
        if (err) logger.warn({ topic, err: err.message }, 'MQTT unsubscribe failed');
      });
    }
  }

  private resubscribeAll(): void {
    for (const topic of this.subscriptions.keys()) {
      this.client?.subscribe(topic, { qos: 1 }, (err) => {
        if (err) logger.warn({ topic, err: err.message }, 'MQTT re-subscribe failed');
      });
    }
  }

  private publishPresence(status: 'online' | 'offline'): void {
    if (!this._instanceId) return;
    this.publish(
      presenceTopic(this._instanceId),
      { status, instanceId: this._instanceId },
      { retain: true },
    );
  }

  private publishPresenceAsync(status: 'online' | 'offline'): Promise<void> {
    const client = this.client;
    const instanceId = this._instanceId;
    return new Promise((resolve) => {
      if (!client || !instanceId) {
        resolve();
        return;
      }
      client.publish(
        presenceTopic(instanceId),
        JSON.stringify({ status, instanceId }),
        { qos: 1, retain: true },
        () => resolve(),
      );
    });
  }

  private resolveInstanceId(): string {
    const fromEnv = this.config.get<string>('MQTT_INSTANCE_ID');
    if (fromEnv && fromEnv.length > 0) return fromEnv;
    const generated = randomUUID();
    logger.warn(
      { generated },
      'MQTT_INSTANCE_ID not set — using an ephemeral id for this process; set MQTT_INSTANCE_ID to keep a stable identity across restarts',
    );
    return generated;
  }
}
