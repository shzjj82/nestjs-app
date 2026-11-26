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

/** 业务注册表 hash：code -> BusinessRegistryEntry JSON；usercenter 写，gateway 读 */
export const BIZ_REGISTRY_KEY = 'biz:registry';

/** 检索可见团队编号。成员变化时 wiki 按数据库重写，检索未命中时 agents 补写。 */
export function wikiTeamIdsKey(input: {
  bizCode: string;
  appCode: string;
  accountId: string;
}): string {
  return `wiki:team-ids:${input.bizCode}:${input.appCode}:${input.accountId}`;
}

export function wikiTeamIdsGenKey(input: {
  bizCode: string;
  appCode: string;
  accountId: string;
}): string {
  return `wiki:team-ids-gen:${input.bizCode}:${input.appCode}:${input.accountId}`;
}

/**
 * 对话检索把业务码同时当作 appCode 查询。
 * 团队记录上的 appCode 可能是另一个值，删除时两把钥匙都清掉。
 */
export function wikiTeamIdsKeys(input: {
  bizCode: string;
  appCode: string;
  accountId: string;
}): string[] {
  const keys = [wikiTeamIdsKey(input)];
  if (input.appCode !== input.bizCode) {
    keys.push(wikiTeamIdsKey({ ...input, appCode: input.bizCode }));
  }
  return keys;
}

/** 成员变更会立刻重写。这个时间只兜住没走到重写的缓存。 */
export const WIKI_TEAM_IDS_TTL_SECONDS = 10 * 60;

export function tokenKey(token: string): string {
  return `auth:token:${token}`;
}

export function refreshTokenKey(token: string): string {
  return `auth:refresh:${token}`;
}

export function userTokenSetKey(userId: string): string {
  return `auth:user:${userId}`;
}

export function userRefreshSetKey(userId: string): string {
  return `auth:user-refresh:${userId}`;
}

export function tokenTtlSeconds(): number {
  const raw = Number(process.env.TOKEN_TTL_SECONDS ?? 2 * 3600);
  return Number.isFinite(raw) && raw > 0 ? raw : 2 * 3600;
}

export function refreshTokenTtlSeconds(): number {
  const raw = Number(process.env.REFRESH_TOKEN_TTL_SECONDS ?? 30 * 24 * 3600);
  return Number.isFinite(raw) && raw > 0 ? raw : 30 * 24 * 3600;
}
