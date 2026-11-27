import { uploadStorageConfig, type UploadStorageConfig } from '@app/common';
import { CosDriver } from './drivers/cos.driver';
import { MinioDriver } from './drivers/minio.driver';
import { OssDriver } from './drivers/oss.driver';
import type { StorageDriver } from './drivers/storage.driver';

export function createStorageDriver(
  config: UploadStorageConfig = uploadStorageConfig(),
): StorageDriver {
  if (config.driver === 'oss') {
    return new OssDriver(config);
  }
  if (config.driver === 'cos') {
    return new CosDriver(config);
  }
  return new MinioDriver(config);
}
