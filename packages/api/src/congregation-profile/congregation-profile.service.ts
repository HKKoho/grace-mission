import { Injectable } from '@nestjs/common';

import {
  congregationProfileSchema,
  type CongregationProfileInput,
  type UpdateCongregationProfileInput,
} from '@clawix/shared';
import { CongregationProfileRepository } from '../db/congregation-profile.repository.js';

@Injectable()
export class CongregationProfileService {
  constructor(private readonly repo: CongregationProfileRepository) {}

  async get(): Promise<CongregationProfileInput> {
    const row = await this.repo.get();
    return congregationProfileSchema.parse(row);
  }

  async update(data: UpdateCongregationProfileInput): Promise<CongregationProfileInput> {
    const row = await this.repo.update(data);
    return congregationProfileSchema.parse(row);
  }
}
