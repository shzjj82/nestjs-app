import {
  DeleteObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import {
  uploadStorageReady,
  type UploadDriver,
  type UploadStorageConfig,
} from '@app/common';
import { rpcFail } from '../../common/rpc';
import type { StoredObject } from '../../common/types';
import type { StorageDriver, StorageDriverStatus } from './storage.driver';

export class S3CompatibleDriver implements StorageDriver {
  readonly name: UploadDriver;
  private readonly client: S3Client | null;

  constructor(private readonly config: UploadStorageConfig) {
    this.name = config.driver;
    this.client = uploadStorageReady(config)
      ? new S3Client({
          region: config.region || 'us-east-1',
          endpoint: config.endpoint,
          forcePathStyle: config.forcePathStyle,
          credentials: {
            accessKeyId: config.accessKey,
            secretAccessKey: config.secretKey,
          },
        })
      : null;
  }

  status(): StorageDriverStatus {
    return {
      name: this.name,
      ready: uploadStorageReady(this.config),
      bucket: this.config.bucket || null,
      endpoint: this.config.endpoint,
    };
  }

  async put(input: {
    key: string;
    body: Buffer;
    contentType: string;
  }): Promise<StoredObject> {
    await this.requireClient().send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType,
      }),
    );
    return {
      driver: this.name,
      bucket: this.config.bucket,
      key: input.key,
      url: this.publicUrl(input.key),
      size: input.body.length,
      contentType: input.contentType,
    };
  }

  async remove(key: string) {
    await this.requireClient().send(
      new DeleteObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
      }),
    );
    return { deleted: true as const, key, driver: this.name };
  }

  async ping(): Promise<boolean> {
    if (!this.client || !uploadStorageReady(this.config)) {
      return false;
    }
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.config.bucket }));
      return true;
    } catch {
      return false;
    }
  }

  private requireClient(): S3Client {
    if (!this.client || !uploadStorageReady(this.config)) {
      rpcFail(
        503,
        `上传存储未配置：请设置 ${this.name} 的 AccessKey / Secret / Bucket`,
      );
    }
    return this.client;
  }

  private publicUrl(key: string): string {
    if (this.config.publicBase) {
      return `${this.config.publicBase.replace(/\/+$/, '')}/${key}`;
    }
    const endpoint = this.config.endpoint.replace(/\/+$/, '');
    if (this.config.forcePathStyle) {
      return `${endpoint}/${this.config.bucket}/${key}`;
    }
    try {
      const url = new URL(endpoint);
      return `${url.protocol}//${this.config.bucket}.${url.host}/${key}`;
    } catch {
      return `${endpoint}/${this.config.bucket}/${key}`;
    }
  }
}
