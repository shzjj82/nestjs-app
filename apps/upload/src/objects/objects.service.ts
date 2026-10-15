import { Injectable } from '@nestjs/common';
import { keyInBiz, requireBizCode } from '../common/biz-scope';
import { asRecord, requiredString, rpcFail } from '../common/rpc';
import { readIncomingFile } from '../common/file-payload';
import { objectKey } from '../common/object-key';
import { StorageService } from '../storage/storage.service';
import { RagNotify } from './rag-notify';

@Injectable()
export class ObjectsService {
  constructor(
    private readonly storage: StorageService,
    private readonly rag: RagNotify,
  ) {}

  async put(payload: unknown) {
    const file = readIncomingFile(payload);
    return this.storage.put({
      key: objectKey(file.prefix, file.filename),
      body: file.body,
      contentType: file.contentType,
    });
  }

  async remove(payload: unknown) {
    const data = asRecord(payload);
    const key = requiredString(data.key, 'key');
    if (!keyInBiz(requireBizCode(data), key)) {
      rpcFail(403, '对象不属于当前业务');
    }
    const result = await this.storage.remove(key);
    this.rag.removeSource(key);
    return result;
  }
}
