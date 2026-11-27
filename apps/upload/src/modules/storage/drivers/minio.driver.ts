import type { UploadStorageConfig } from '@app/common';
import { S3CompatibleDriver } from './s3.driver';

/** MinIO：路径风格 S3 */
export class MinioDriver extends S3CompatibleDriver {
  constructor(config: UploadStorageConfig) {
    super({ ...config, driver: 'minio', forcePathStyle: true });
  }
}
