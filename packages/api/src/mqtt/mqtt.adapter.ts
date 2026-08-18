import { randomUUID } from 'node:crypto';
import { createLogger } from '@clawix/shared';
import type {
  ChannelAdapter,
  ChannelAdapterConfig,
  InboundMessage,
  MessageHandler,
  OutboundMessage,
} from '@clawix/shared';

import type { MqttClientService } from './mqtt-client.service.js';

const logger = createLogger('channels:mqtt');

const DEDUPE_CACHE_SIZE = 500;

interface MqttInboxEnvelope {
  readonly v: 1;
  readonly senderId: string;
  readonly messageId: string;
  readonly text: string;
  readonly timestamp: string;
}

function isMqttInboxEnvelope(value: unknown): value is MqttInboxEnvelope {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    v['v'] === 1 &&
    typeof v['senderId'] === 'string' &&
    typeof v['messageId'] === 'string' &&
    typeof v['text'] === 'string' &&
    typeof v['timestamp'] === 'string'
  );
}

function inboxTopic(instanceId: string): string {
  return `clawix/${instanceId}/inbox`;
}

/**
 * MQTT federation channel adapter. Wraps the single shared MqttClientService
 * connection (mqtt-client.service.ts) instead of opening its own — MQTT is
 * one connection per Clawix instance, not one per channel row like Telegram.
 *
 * `senderId` in the inbox envelope is a self-reported claim, not yet
 * cryptographically verified (payload signing is Phase 4) — only safe on a
 * broker whose publish ACLs you fully control. See docs/MQTT.md §5.
 */
export function createMqttAdapter(
  config: ChannelAdapterConfig,
  mqttClient: MqttClientService,
): ChannelAdapter {
  let messageHandler: MessageHandler | null = null;

  // Bounded de-dupe of recently seen envelope ids — QoS 1 can redeliver.
  // Best-effort, not an exactly-once guarantee.
  const seenMessageIds = new Set<string>();
  const seenOrder: string[] = [];
  function alreadySeen(messageId: string): boolean {
    if (seenMessageIds.has(messageId)) return true;
    seenMessageIds.add(messageId);
    seenOrder.push(messageId);
    if (seenOrder.length > DEDUPE_CACHE_SIZE) {
      const oldest = seenOrder.shift();
      if (oldest) seenMessageIds.delete(oldest);
    }
    return false;
  }

  return {
    id: config.id,
    type: 'mqtt',

    async connect(): Promise<void> {
      const instanceId = mqttClient.instanceId;
      if (!instanceId) {
        logger.info('MQTT not configured — mqtt channel adapter stays idle');
        return;
      }

      mqttClient.subscribe(inboxTopic(instanceId), (payload: unknown) => {
        if (!isMqttInboxEnvelope(payload)) {
          logger.warn({ payload }, 'Dropping malformed MQTT inbox envelope');
          return;
        }
        if (alreadySeen(payload.messageId)) {
          logger.debug({ messageId: payload.messageId }, 'Dropping duplicate MQTT message');
          return;
        }
        if (!messageHandler) {
          logger.warn('No message handler registered, ignoring MQTT message');
          return;
        }

        const inbound: InboundMessage = {
          channelType: 'mqtt',
          channelMessageId: payload.messageId,
          senderId: payload.senderId,
          senderName: payload.senderId,
          text: payload.text,
          timestamp: new Date(payload.timestamp),
        };

        messageHandler(inbound).catch((error: unknown) => {
          const errorMsg = error instanceof Error ? error.message : String(error);
          logger.error(
            { senderId: payload.senderId, error: errorMsg },
            'Error handling MQTT message',
          );
        });
      });
    },

    async disconnect(): Promise<void> {
      const instanceId = mqttClient.instanceId;
      if (!instanceId) return;
      mqttClient.unsubscribe(inboxTopic(instanceId));
    },

    async sendMessage(message: OutboundMessage): Promise<void> {
      const instanceId = mqttClient.instanceId;
      if (!instanceId) return;

      const envelope: MqttInboxEnvelope = {
        v: 1,
        senderId: instanceId,
        messageId: randomUUID(),
        text: message.text,
        timestamp: new Date().toISOString(),
      };
      mqttClient.publish(inboxTopic(message.recipientId), envelope);
    },

    onMessage(handler: MessageHandler): void {
      messageHandler = handler;
    },
  };
}
