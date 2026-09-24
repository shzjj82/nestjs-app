import { Injectable, Logger } from '@nestjs/common';
import { createStorageDriver } from './create-driver';
import type { StorageDriver } from './drivers/storage.driver';
import type { StoredObject } from '../common/types';

@Injectable()
export class StorageService {
  private readonly logger = new Logger('UploadStorage');
  private readonly driver: StorageDriver;

  constructor() {
    this.driver = createStorageDriver();
    const status = this.driver.status();
    if (!status.ready) {
      this.logger.warn(
        `存储未配置完整：driver=${status.name}。请设置对应 AccessKey / Secret / Bucket`,
      );
    }
  }

  status() {
    return this.driver.status();
  }

  put(input: {
    key: string;
    body: Buffer;
    contentType: string;
  }): Promise<StoredObject> {
    return this.driver.put(input);
  }

  remove(key: string) {
    return this.driver.remove(key);
  }

  ping(): Promise<boolean> {
    return this.driver.ping();
  }
}
