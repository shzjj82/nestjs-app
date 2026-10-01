import { createStorageDriver } from '../../src/storage/create-driver';
import { CosDriver } from '../../src/storage/drivers/cos.driver';
import { MinioDriver } from '../../src/storage/drivers/minio.driver';
import { OssDriver } from '../../src/storage/drivers/oss.driver';

const base = {
  endpoint: 'http://127.0.0.1:9000',
  region: 'us-east-1',
  bucket: 'uploads',
  accessKey: 'key',
  secretKey: 'secret',
  publicBase: '',
  forcePathStyle: true,
};

describe('createStorageDriver', () => {
  it('picks minio / oss / cos by driver', () => {
    expect(createStorageDriver({ ...base, driver: 'minio' })).toBeInstanceOf(
      MinioDriver,
    );
    expect(createStorageDriver({ ...base, driver: 'oss' })).toBeInstanceOf(
      OssDriver,
    );
    expect(createStorageDriver({ ...base, driver: 'cos' })).toBeInstanceOf(
      CosDriver,
    );
  });
});
