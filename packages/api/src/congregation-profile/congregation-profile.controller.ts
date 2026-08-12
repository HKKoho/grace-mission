import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import {
  updateCongregationProfileSchema,
  type UpdateCongregationProfileInput,
} from '@clawix/shared';
import { Roles } from '../auth/roles.decorator.js';
import { UserRole } from '../generated/prisma/enums.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { CongregationProfileService } from './congregation-profile.service.js';

@ApiTags('admin/congregation-profile')
@Controller('admin/congregation-profile')
@Roles(UserRole.super_admin)
export class CongregationProfileController {
  constructor(private readonly service: CongregationProfileService) {}

  @Get()
  async get() {
    return { success: true, data: await this.service.get() };
  }

  @Patch()
  async update(
    @Body(new ZodValidationPipe(updateCongregationProfileSchema))
    body: UpdateCongregationProfileInput,
  ) {
    return { success: true, data: await this.service.update(body) };
  }
}
