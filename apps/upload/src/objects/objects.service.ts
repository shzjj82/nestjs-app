import { Injectable } from '@nestjs/common';
import { asRecord, requiredString, rpcFail } from '../common/rpc';
import { readIncomingFile } from '../common/file-payload';
import { objectKey } from '../common/object-key';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class ObjectsService {
  constructor(private readonly storage: StorageService) {}

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
    if (key.includes('..')) {
      rpcFail(400, '非法对象键');
    }
    return this.storage.remove(key);
  }
}
