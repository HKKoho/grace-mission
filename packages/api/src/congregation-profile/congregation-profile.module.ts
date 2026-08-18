import { Module } from '@nestjs/common';

import { CongregationProfileController } from './congregation-profile.controller.js';
import { CongregationProfileService } from './congregation-profile.service.js';

@Module({
  controllers: [CongregationProfileController],
  providers: [CongregationProfileService],
  exports: [CongregationProfileService],
})
export class CongregationProfileModule {}
