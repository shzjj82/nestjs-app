import { Injectable } from '@nestjs/common';
import { bizPrefix, requireBizCode } from '../common/biz-scope';
import { asRecord, requiredString, rpcFail } from '../common/rpc';
import { readIncomingFile } from '../common/file-payload';
import { JobsStore } from './jobs.store';

@Injectable()
export class JobsService {
  constructor(private readonly store: JobsStore) {}

  enqueue(payload: unknown) {
    return this.store.enqueue(readIncomingFile(payload));
  }

  async findOne(payload: unknown) {
    const data = asRecord(payload);
    const job = await this.store.requireJob(requiredString(data.id, 'id'));
    const own = bizPrefix(requireBizCode(data), '');
    if (job.prefix !== own && !job.prefix.startsWith(`${own}/`)) {
      rpcFail(404, '上传任务不存在或已过期');
    }
    return job;
  }
}
