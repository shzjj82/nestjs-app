import type { UploadStorageConfig } from '@app/common';
import { S3CompatibleDriver } from './s3.driver';

/** 阿里云 OSS 的 S3 兼容接入 */
export class OssDriver extends S3CompatibleDriver {
  constructor(config: UploadStorageConfig) {
    super({ ...config, driver: 'oss', forcePathStyle: false });
  }
}
