import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { DbModule } from '../db/db.module.js';
import { EngineModule } from '../engine/engine.module.js';
import { CommandModule } from '../commands/command.module.js';
import { MqttModule } from '../mqtt/mqtt.module.js';
import { MqttClientService } from '../mqtt/mqtt-client.service.js';
import { ChannelRegistry } from './channel.registry.js';
import { MessageRouterService } from './message-router.service.js';
import { ChannelManagerService } from './channel-manager.service.js';
import { ChannelRepository } from '../db/channel.repository.js';
import { SessionRepository } from '../db/session.repository.js';
import { UserRepository } from '../db/user.repository.js';
import { RedisPubSubService } from '../cache/redis-pubsub.service.js';
import { ChannelsController } from './channels.controller.js';
import { createTelegramAdapter } from './telegram/telegram.adapter.js';
import { createWhatsAppAdapter } from './whatsapp/whatsapp.adapter.js';
import { createWebAdapter } from './web/web.adapter.js';
import { createMqttAdapter } from '../mqtt/mqtt.adapter.js';
import { WebChatGateway } from './web/web.gateway.js';

@Module({
  imports: [DbModule, EngineModule, JwtModule.register({}), CommandModule, MqttModule],
  controllers: [ChannelsController],
  providers: [
    ChannelRegistry,
    MessageRouterService,
    WebChatGateway,
    {
      provide: ChannelManagerService,
      useFactory: (
        channelRepo: ChannelRepository,
        registry: ChannelRegistry,
        router: MessageRouterService,
        pubsub: RedisPubSubService,
        sessionRepo: SessionRepository,
        userRepo: UserRepository,
        gateway: WebChatGateway,
        mqttClient: MqttClientService,
      ) => {
        // Register channel adapter factories
        registry.register('telegram', (config) => createTelegramAdapter(config));
        registry.register('whatsapp', (config) => createWhatsAppAdapter(config));
        registry.register('web', (config) => {
          const adapter = createWebAdapter(config);
          gateway.setAdapter(adapter);
          return adapter;
        });
        registry.register('mqtt', (config) => createMqttAdapter(config, mqttClient));

        return new ChannelManagerService(
          channelRepo,
          registry,
          router,
          pubsub,
          sessionRepo,
          userRepo,
          mqttClient,
        );
      },
      inject: [
        ChannelRepository,
        ChannelRegistry,
        MessageRouterService,
        RedisPubSubService,
        SessionRepository,
        UserRepository,
        WebChatGateway,
        MqttClientService,
      ],
    },
  ],
  exports: [MessageRouterService, ChannelManagerService, WebChatGateway],
})
export class ChannelsModule {}
