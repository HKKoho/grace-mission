import type { Department, UserRole } from '../generated/prisma/enums.js';

export interface JwtPayload {
  sub: string; // userId
  email: string;
  role: UserRole;
  department: Department;
  policyName: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}
