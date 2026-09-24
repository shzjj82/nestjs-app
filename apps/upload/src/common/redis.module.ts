import { Global, Inject, Module, OnModuleDestroy } from '@nestjs/common';
import type Redis from 'ioredis';
import { createRedis, REDIS } from '@app/common';

@Global()
@Module({
  providers: [
    {
      provide: REDIS,
      useFactory: createRedis,
    },
  ],
  exports: [REDIS],
})
export class RedisModule implements OnModuleDestroy {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async onModuleDestroy() {
    this.redis.disconnect();
  }
}
