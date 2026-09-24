export interface IncomingFile {
  filename: string;
  contentType: string;
  prefix: string;
  body: Buffer;
}

export interface StoredObject {
  driver: string;
  bucket: string;
  key: string;
  url: string;
  size: number;
  contentType: string;
}

export type UploadJobStatus = 'queued' | 'uploading' | 'done' | 'failed';

export interface UploadJob {
  id: string;
  status: UploadJobStatus;
  filename: string;
  contentType: string;
  prefix: string;
  key?: string;
  url?: string;
  driver?: string;
  size?: number;
  error?: string;
  createdAt: string;
  updatedAt: string;
}
