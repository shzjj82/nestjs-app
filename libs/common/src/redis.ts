import Redis from 'ioredis';
import { redisUrl } from './env';

export const REDIS = 'REDIS';

export function createRedis(): Redis {
  return new Redis(redisUrl(), {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: false,
  });
}

export function tokenKey(token: string): string {
  return `auth:token:${token}`;
}

export function refreshTokenKey(token: string): string {
  return `auth:refresh:${token}`;
}

export function userTokenSetKey(userId: string, appId: string): string {
  return `auth:user:${userId}:${appId}`;
}

export function userRefreshSetKey(userId: string, appId: string): string {
  return `auth:user-refresh:${userId}:${appId}`;
}

export function tokenTtlSeconds(): number {
  const raw = Number(process.env.TOKEN_TTL_SECONDS ?? 2 * 3600);
  return Number.isFinite(raw) && raw > 0 ? raw : 2 * 3600;
}

export function refreshTokenTtlSeconds(): number {
  const raw = Number(process.env.REFRESH_TOKEN_TTL_SECONDS ?? 30 * 24 * 3600);
  return Number.isFinite(raw) && raw > 0 ? raw : 30 * 24 * 3600;
}
