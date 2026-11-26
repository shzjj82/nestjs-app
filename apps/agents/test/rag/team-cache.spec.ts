import {
  loadCachedTeamIds,
  publishTeamIds,
  readTeamIdsGeneration,
  storeTeamIdsIfCurrent,
  WIKI_TEAM_IDS_TTL_SECONDS,
  wikiTeamIdsKey,
  wikiTeamIdsKeys,
} from '@app/common';
import type Redis from 'ioredis';

function memoryRedis() {
  const store = new Map<string, string>();
  const redis = {
    get: async (key: string) => store.get(key) ?? null,
    incr: async (key: string) => {
      const next = Number(store.get(key) ?? '0') + 1;
      store.set(key, String(next));
      return next;
    },
    eval: async (
      _script: string,
      _keys: number,
      idsKey: string,
      genKey: string,
      gen: string,
      payload: string,
      ttl: string,
    ) => {
      const cur = store.get(genKey) ?? '0';
      if (cur !== gen) {
        return 0;
      }
      expect(Number(ttl)).toBe(WIKI_TEAM_IDS_TTL_SECONDS);
      store.set(idsKey, payload);
      return 1;
    },
  };
  return { store, redis: redis as unknown as Redis };
}

describe('team id cache', () => {
  const scope = { bizCode: 'wiki', appCode: 'wiki', accountId: 'acct-1' };

  it('rewrites the cached team list from the latest membership', async () => {
    const { redis } = memoryRedis();
    await publishTeamIds(redis, scope, ['team-a']);
    await publishTeamIds(redis, scope, ['team-b']);
    expect(await loadCachedTeamIds(redis, scope)).toEqual(['team-b']);
    expect(wikiTeamIdsKey(scope)).toBe('wiki:team-ids:wiki:wiki:acct-1');
  });

  it('keeps an empty team list', async () => {
    const { redis } = memoryRedis();
    await publishTeamIds(redis, scope, []);
    expect(await loadCachedTeamIds(redis, scope)).toEqual([]);
  });

  it('does not let an older search overwrite the list just published', async () => {
    const { redis } = memoryRedis();
    const seen = await readTeamIdsGeneration(redis, scope);
    await publishTeamIds(redis, scope, ['team-new']);
    await storeTeamIdsIfCurrent(redis, scope, ['team-old'], seen);
    expect(await loadCachedTeamIds(redis, scope)).toEqual(['team-new']);
  });

  it('clears both the stored app code and the biz code used by chat search', () => {
    expect(
      wikiTeamIdsKeys({ bizCode: 'wiki', appCode: 'app-1', accountId: 'acct-1' }),
    ).toEqual(['wiki:team-ids:wiki:app-1:acct-1', 'wiki:team-ids:wiki:wiki:acct-1']);
  });
});
