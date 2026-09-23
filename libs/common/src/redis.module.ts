import { Global, Inject, Module, OnModuleDestroy } from '@nestjs/common';
import type Redis from 'ioredis';
import { createRedis, REDIS } from './redis';
import { TokenStore } from './token';

@Global()
@Module({
  providers: [
    {
      provide: REDIS,
      useFactory: createRedis,
    },
    {
      provide: TokenStore,
      useFactory: (redis: Redis) => new TokenStore(redis),
      inject: [REDIS],
    },
  ],
  exports: [REDIS, TokenStore],
})
export class RedisInfraModule implements OnModuleDestroy {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async onModuleDestroy() {
    this.redis.disconnect();
  }
}
