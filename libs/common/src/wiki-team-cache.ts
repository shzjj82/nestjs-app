import type Redis from 'ioredis';
import { WIKI_TEAM_IDS_TTL_SECONDS, wikiTeamIdsGenKey, wikiTeamIdsKey } from './redis';

export type TeamIdScope = {
  bizCode: string;
  appCode: string;
  accountId: string;
};

/**
 * 只有版本号仍是写入前看到的那一版，才覆盖团队名单。
 * 成员变更会先把版本号加一，进行中的旧查询就不能把旧名单写回去。
 */
const WRITE_IF_CURRENT = `
local cur = redis.call('GET', KEYS[2])
if not cur then
  cur = '0'
end
if cur == ARGV[1] then
  redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3])
  if cur ~= '0' then
    redis.call('EXPIRE', KEYS[2], ARGV[3])
  end
  return 1
end
return 0
`;

/** 命中返回团队编号，空数组也是命中。没有这条缓存时返回 null。 */
export async function loadCachedTeamIds(redis: Redis, scope: TeamIdScope): Promise<string[] | null> {
  try {
    const raw = await redis.get(wikiTeamIdsKey(scope));
    if (raw == null) {
      return null;
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== 'string')) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function readTeamIdsGeneration(redis: Redis, scope: TeamIdScope): Promise<string> {
  try {
    return (await redis.get(wikiTeamIdsGenKey(scope))) ?? '0';
  } catch {
    return '0';
  }
}

/** 检索回源后补写。版本已经变过就放弃，避免盖住刚刚同步的名单。 */
export async function storeTeamIdsIfCurrent(
  redis: Redis,
  scope: TeamIdScope,
  ids: string[],
  seenGen: string,
): Promise<void> {
  try {
    await writeIfCurrent(redis, scope, ids, seenGen);
  } catch {
    // 写缓存失败时这次检索仍用刚查到的结果
  }
}

/** 成员变更之后，把数据库里的最新名单写进 Redis。 */
export async function publishTeamIds(redis: Redis, scope: TeamIdScope, ids: string[]): Promise<void> {
  const gen = await redis.incr(wikiTeamIdsGenKey(scope));
  await writeIfCurrent(redis, scope, ids, String(gen));
}

async function writeIfCurrent(redis: Redis, scope: TeamIdScope, ids: string[], gen: string) {
  await redis.eval(
    WRITE_IF_CURRENT,
    2,
    wikiTeamIdsKey(scope),
    wikiTeamIdsGenKey(scope),
    gen,
    JSON.stringify(ids),
    String(WIKI_TEAM_IDS_TTL_SECONDS),
  );
}
