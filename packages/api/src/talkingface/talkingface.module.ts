import { Module } from '@nestjs/common';

import { EngineModule } from '../engine/engine.module.js';
import { TtsModule } from '../tts/tts.module.js';
import { TalkingFaceController } from './talkingface.controller.js';

@Module({
  imports: [EngineModule, TtsModule],
  controllers: [TalkingFaceController],
})
export class TalkingFaceModule {}
