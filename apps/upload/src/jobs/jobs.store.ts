import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type Redis from 'ioredis';
import { REDIS } from '@app/common';
import { rpcFail } from '../common/rpc';
import type { IncomingFile, UploadJob } from '../common/types';

const QUEUE_KEY = 'upload:queue';
const JOB_TTL_SECONDS = 24 * 3600;
const BLOB_TTL_SECONDS = 2 * 3600;

@Injectable()
export class JobsStore implements OnModuleDestroy {
  private readonly blocker: Redis;

  constructor(@Inject(REDIS) private readonly redis: Redis) {
    this.blocker = this.redis.duplicate();
  }

  async enqueue(input: IncomingFile): Promise<UploadJob> {
    const id = randomUUID();
    const now = new Date().toISOString();
    const job: UploadJob = {
      id,
      status: 'queued',
      filename: input.filename,
      contentType: input.contentType,
      prefix: input.prefix,
      createdAt: now,
      updatedAt: now,
    };
    const pipe = this.redis.multi();
    pipe.set(this.blobKey(id), input.body, 'EX', BLOB_TTL_SECONDS);
    pipe.set(this.jobKey(id), JSON.stringify(job), 'EX', JOB_TTL_SECONDS);
    pipe.lpush(QUEUE_KEY, id);
    await pipe.exec();
    return job;
  }

  async take(timeoutSeconds = 5): Promise<string | null> {
    const hit = await this.blocker.brpop(QUEUE_KEY, timeoutSeconds);
    return hit?.[1] ?? null;
  }

  async readBlob(id: string): Promise<Buffer | null> {
    const raw = await this.redis.getBuffer(this.blobKey(id));
    return raw && raw.length ? raw : null;
  }

  async dropBlob(id: string) {
    await this.redis.del(this.blobKey(id));
  }

  async getJob(id: string): Promise<UploadJob | null> {
    const raw = await this.redis.get(this.jobKey(id));
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as UploadJob;
  }

  async requireJob(id: string): Promise<UploadJob> {
    const job = await this.getJob(id);
    if (!job) {
      rpcFail(404, '上传任务不存在或已过期');
    }
    return job;
  }

  async saveJob(job: UploadJob) {
    job.updatedAt = new Date().toISOString();
    await this.redis.set(this.jobKey(job.id), JSON.stringify(job), 'EX', JOB_TTL_SECONDS);
  }

  async onModuleDestroy() {
    this.blocker.disconnect();
  }

  private jobKey(id: string) {
    return `upload:job:${id}`;
  }

  private blobKey(id: string) {
    return `upload:blob:${id}`;
  }
}
