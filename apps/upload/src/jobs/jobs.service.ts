import { Injectable } from '@nestjs/common';
import { asRecord, requiredString } from '../common/rpc';
import { readIncomingFile } from '../common/file-payload';
import { JobsStore } from './jobs.store';

@Injectable()
export class JobsService {
  constructor(private readonly store: JobsStore) {}

  enqueue(payload: unknown) {
    return this.store.enqueue(readIncomingFile(payload));
  }

  findOne(payload: unknown) {
    const data = asRecord(payload);
    return this.store.requireJob(requiredString(data.id, 'id'));
  }
}
