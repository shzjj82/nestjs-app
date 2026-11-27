import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { REDIS, asRecord, requiredString, rpcFail } from '@app/common';
import type Redis from 'ioredis';
import { Repository } from 'typeorm';
import { PromptEntity } from './entity/prompt.entity';

const BODY_MAX = 20_000;

@Injectable()
export class PromptsService {
  constructor(
    @InjectRepository(PromptEntity)
    private readonly prompts: Repository<PromptEntity>,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  /** Redis 里有就用缓存；没有就从数据库取出并写入 Redis。 */
  async text(code: string): Promise<string> {
    const key = promptKey(code);
    const cached = await this.redis.get(key);
    if (cached) {
      return cached;
    }
    const row = await this.prompts.findOne({ where: { code } });
    if (!row?.body) {
      rpcFail(404, '提示词不存在');
    }
    await this.redis.set(key, row.body);
    return row.body;
  }

  async find(payload: unknown) {
    const code = requiredString(asRecord(payload).code, 'code');
    return { code, body: await this.text(code) };
  }

  /** 写入数据库后删掉 Redis，下次读取再装入新正文。 */
  async update(payload: unknown) {
    const data = asRecord(payload);
    const code = requiredString(data.code, 'code');
    const body = requiredString(data.body, 'body');
    if (body.length > BODY_MAX) {
      rpcFail(400, '提示词过长');
    }
    const row = await this.prompts.findOne({ where: { code } });
    if (!row) {
      rpcFail(404, '提示词不存在');
    }
    row.body = body;
    const saved = await this.prompts.save(row);
    await this.redis.del(promptKey(code));
    return { code, updatedAt: saved.updatedAt.toISOString() };
  }
}

export function promptKey(code: string): string {
  return `agents:prompt:${code}`;
}
