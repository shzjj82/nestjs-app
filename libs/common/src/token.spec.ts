import { TokenStore } from './token';

function createMemoryRedis() {
  const values = new Map<string, string>();
  const sets = new Map<string, Set<string>>();
  const redis = {
    multi() {
      const ops: Array<() => void> = [];
      const chain = {
        set(key: string, value: string) {
          ops.push(() => values.set(key, value));
          return chain;
        },
        sadd(key: string, member: string) {
          ops.push(() => {
            const set = sets.get(key) ?? new Set<string>();
            set.add(member);
            sets.set(key, set);
          });
          return chain;
        },
        expire() {
          return chain;
        },
        del(key: string) {
          ops.push(() => {
            values.delete(key);
            sets.delete(key);
          });
          return chain;
        },
        srem(key: string, member: string) {
          ops.push(() => sets.get(key)?.delete(member));
          return chain;
        },
        async exec() {
          ops.forEach((op) => op());
          return [];
        },
      };
      return chain;
    },
    async get(key: string) {
      return values.get(key) ?? null;
    },
    async smembers(key: string) {
      return [...(sets.get(key) ?? [])];
    },
  };
  return { redis, values };
}

const baseSession = {
  userId: 'u-1',
  appId: 'default',
  username: 'alice',
  nickname: 'Alice',
  role: 'user' as const,
  roles: ['user'],
  permissions: ['user.query'],
};

describe('TokenStore', () => {
  it('issues access and refresh tokens', async () => {
    const { redis } = createMemoryRedis();
    const store = new TokenStore(redis as never);
    const pair = await store.issue(baseSession);
    const loaded = await store.get(pair.session.token);
    const refresh = await store.getRefresh(pair.refreshToken);
    expect(loaded?.userId).toBe('u-1');
    expect(loaded?.refreshToken).toBe(pair.refreshToken);
    expect(refresh?.accessToken).toBe(pair.session.token);
    expect(pair.expiresIn).toBeGreaterThan(0);
    expect(pair.refreshExpiresIn).toBeGreaterThan(pair.expiresIn);
  });

  it('revokes access and its refresh token together', async () => {
    const { redis } = createMemoryRedis();
    const store = new TokenStore(redis as never);
    const pair = await store.issue(baseSession);
    await store.revoke(pair.session.token);
    expect(await store.get(pair.session.token)).toBeNull();
    expect(await store.getRefresh(pair.refreshToken)).toBeNull();
  });

  it('consumes refresh token and drops the old access token', async () => {
    const { redis } = createMemoryRedis();
    const store = new TokenStore(redis as never);
    const pair = await store.issue(baseSession);
    const record = await store.revokeByRefresh(pair.refreshToken);
    expect(record?.userId).toBe('u-1');
    expect(await store.get(pair.session.token)).toBeNull();
    expect(await store.getRefresh(pair.refreshToken)).toBeNull();
  });
});
