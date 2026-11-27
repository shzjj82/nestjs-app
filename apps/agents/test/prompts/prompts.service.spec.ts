jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
  TypeOrmModule: { forFeature: () => ({}) },
}));

import { RpcException } from '@nestjs/microservices';
import type { Repository } from 'typeorm';
import type { PromptEntity } from '../../src/modules/prompts/entity/prompt.entity';
import { promptKey, PromptsService } from '../../src/modules/prompts/prompts.service';

function makeRedis() {
  const store = new Map<string, string>();
  return {
    store,
    get: jest.fn(async (key: string) => store.get(key) ?? null),
    set: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
      return 'OK';
    }),
    del: jest.fn(async (key: string) => {
      const had = store.delete(key);
      return had ? 1 : 0;
    }),
  };
}

function makeRepo(row?: PromptEntity) {
  const saved = row ? { ...row } : undefined;
  return {
    saved,
    findOne: jest.fn(async () => (saved ? { ...saved } : null)),
    save: jest.fn(async (next: PromptEntity) => {
      Object.assign(saved ?? {}, next);
      if (saved) {
        saved.body = next.body;
        saved.updatedAt = next.updatedAt;
      }
      return next;
    }),
  };
}

describe('PromptsService', () => {
  it('loads a missing prompt from the database and stores it in redis', async () => {
    const redis = makeRedis();
    const repo = makeRepo({
      code: 'chat.default',
      body: '数据库里的提示词',
      updatedAt: new Date('2026-11-27T00:00:00.000Z'),
    });
    const service = new PromptsService(
      repo as unknown as Repository<PromptEntity>,
      redis as never,
    );

    await expect(service.text('chat.default')).resolves.toBe('数据库里的提示词');
    expect(redis.store.get(promptKey('chat.default'))).toBe('数据库里的提示词');

    repo.findOne.mockClear();
    await expect(service.text('chat.default')).resolves.toBe('数据库里的提示词');
    expect(repo.findOne).not.toHaveBeenCalled();
  });

  it('deletes the redis copy when the prompt is updated', async () => {
    const redis = makeRedis();
    redis.store.set(promptKey('chat.default'), '旧正文');
    const updatedAt = new Date('2026-11-27T01:00:00.000Z');
    const repo = makeRepo({
      code: 'chat.default',
      body: '旧正文',
      updatedAt,
    });
    repo.save.mockImplementation(async (next: PromptEntity) => {
      next.updatedAt = new Date('2026-11-27T02:00:00.000Z');
      return next;
    });
    const service = new PromptsService(
      repo as unknown as Repository<PromptEntity>,
      redis as never,
    );

    await expect(service.update({ code: 'chat.default', body: '新正文' })).resolves.toEqual({
      code: 'chat.default',
      updatedAt: '2026-11-27T02:00:00.000Z',
    });
    expect(redis.store.has(promptKey('chat.default'))).toBe(false);
    expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ body: '新正文' }));
  });

  it('rejects an unknown code', async () => {
    const service = new PromptsService(
      makeRepo() as unknown as Repository<PromptEntity>,
      makeRedis() as never,
    );
    await expect(service.text('missing')).rejects.toBeInstanceOf(RpcException);
  });
});
