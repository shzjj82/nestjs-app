import { randomBytes } from 'crypto';
import type Redis from 'ioredis';
import type { AuthSession } from './types';
import {
  refreshTokenKey,
  refreshTokenTtlSeconds,
  tokenKey,
  tokenTtlSeconds,
  userRefreshSetKey,
  userTokenSetKey,
} from './redis';

export interface RefreshRecord {
  token: string;
  accessToken: string;
  userId: string;
  appId: string;
}

export interface TokenPair {
  session: AuthSession;
  refreshToken: string;
  expiresIn: number;
  refreshExpiresIn: number;
}

export class TokenStore {
  constructor(private readonly redis: Redis) {}

  async issue(session: Omit<AuthSession, 'token' | 'refreshToken'>): Promise<TokenPair> {
    const accessToken = randomBytes(32).toString('hex');
    const refreshToken = randomBytes(32).toString('hex');
    const expiresIn = tokenTtlSeconds();
    const refreshExpiresIn = refreshTokenTtlSeconds();
    const full: AuthSession = { ...session, token: accessToken, refreshToken };
    const record: RefreshRecord = {
      token: refreshToken,
      accessToken,
      userId: session.userId,
      appId: session.appId,
    };
    const accessSet = userTokenSetKey(session.userId, session.appId);
    const refreshSet = userRefreshSetKey(session.userId, session.appId);
    await this.redis
      .multi()
      .set(tokenKey(accessToken), JSON.stringify(full), 'EX', expiresIn)
      .set(refreshTokenKey(refreshToken), JSON.stringify(record), 'EX', refreshExpiresIn)
      .sadd(accessSet, accessToken)
      .expire(accessSet, refreshExpiresIn)
      .sadd(refreshSet, refreshToken)
      .expire(refreshSet, refreshExpiresIn)
      .exec();
    return { session: full, refreshToken, expiresIn, refreshExpiresIn };
  }

  async get(token: string): Promise<AuthSession | null> {
    if (!token) {
      return null;
    }
    return this.readJson<AuthSession>(tokenKey(token));
  }

  async getRefresh(token: string): Promise<RefreshRecord | null> {
    if (!token) {
      return null;
    }
    return this.readJson<RefreshRecord>(refreshTokenKey(token));
  }

  async revoke(token: string): Promise<void> {
    const session = await this.get(token);
    const pipeline = this.redis.multi().del(tokenKey(token));
    if (session) {
      pipeline.srem(userTokenSetKey(session.userId, session.appId), token);
      if (session.refreshToken) {
        pipeline.del(refreshTokenKey(session.refreshToken));
        pipeline.srem(
          userRefreshSetKey(session.userId, session.appId),
          session.refreshToken,
        );
      }
    }
    await pipeline.exec();
  }

  async revokeByRefresh(refreshToken: string): Promise<RefreshRecord | null> {
    const record = await this.getRefresh(refreshToken);
    const pipeline = this.redis.multi().del(refreshTokenKey(refreshToken));
    if (record) {
      pipeline.del(tokenKey(record.accessToken));
      pipeline.srem(userTokenSetKey(record.userId, record.appId), record.accessToken);
      pipeline.srem(userRefreshSetKey(record.userId, record.appId), refreshToken);
    }
    await pipeline.exec();
    return record;
  }

  async revokeAll(userId: string, appId: string): Promise<void> {
    const accessSet = userTokenSetKey(userId, appId);
    const refreshSet = userRefreshSetKey(userId, appId);
    const [accessTokens, refreshTokens] = await Promise.all([
      this.redis.smembers(accessSet),
      this.redis.smembers(refreshSet),
    ]);
    const pipeline = this.redis.multi().del(accessSet).del(refreshSet);
    for (const token of accessTokens) {
      pipeline.del(tokenKey(token));
    }
    for (const token of refreshTokens) {
      pipeline.del(refreshTokenKey(token));
    }
    await pipeline.exec();
  }

  private async readJson<T>(key: string): Promise<T | null> {
    const raw = await this.redis.get(key);
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }
}
