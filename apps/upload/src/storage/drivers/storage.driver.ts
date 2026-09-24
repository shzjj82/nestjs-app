import type { StoredObject } from '../../common/types';

export interface StorageDriverStatus {
  name: string;
  ready: boolean;
  bucket: string | null;
  endpoint: string;
}

export interface StorageDriver {
  readonly name: string;
  status(): StorageDriverStatus;
  put(input: {
    key: string;
    body: Buffer;
    contentType: string;
  }): Promise<StoredObject>;
  remove(key: string): Promise<{ deleted: true; key: string; driver: string }>;
  ping(): Promise<boolean>;
}
