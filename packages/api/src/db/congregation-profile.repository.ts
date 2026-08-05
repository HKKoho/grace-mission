import { Injectable } from '@nestjs/common';

import type { CongregationProfile } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

const DEFAULT_ID = 'default';

type UpdateData = Partial<Omit<CongregationProfile, 'id' | 'updatedAt'>>;

@Injectable()
export class CongregationProfileRepository {
  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<CongregationProfile> {
    const existing = await this.prisma.congregationProfile.findUnique({
      where: { id: DEFAULT_ID },
    });
    if (existing) return existing;

    return this.prisma.congregationProfile.upsert({
      where: { id: DEFAULT_ID },
      create: { id: DEFAULT_ID },
      update: {},
    });
  }

  async update(data: UpdateData): Promise<CongregationProfile> {
    return this.prisma.congregationProfile.upsert({
      where: { id: DEFAULT_ID },
      create: { id: DEFAULT_ID, ...data },
      update: data,
    });
  }
}
