import type { UploadStorageConfig } from '@app/common';
import { S3CompatibleDriver } from './s3.driver';

/** 腾讯云 COS 的 S3 兼容接入 */
export class CosDriver extends S3CompatibleDriver {
  constructor(config: UploadStorageConfig) {
    super({ ...config, driver: 'cos', forcePathStyle: false });
  }
}
