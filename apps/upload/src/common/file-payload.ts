import { uploadMaxBytes } from '@app/common';
import { asRecord, requiredString, rpcFail } from './rpc';
import type { IncomingFile } from './types';

export function readIncomingFile(payload: unknown): IncomingFile {
  const data = asRecord(payload);
  const filename = requiredString(data.filename ?? 'file', 'filename');
  const contentType =
    typeof data.contentType === 'string' && data.contentType.trim()
      ? data.contentType.trim()
      : 'application/octet-stream';
  const prefix = typeof data.prefix === 'string' ? data.prefix : '';
  const base64 = requiredString(data.base64, 'file');
  let body: Buffer;
  try {
    body = Buffer.from(base64, 'base64');
  } catch {
    rpcFail(400, '文件内容无效');
  }
  if (!body.length) {
    rpcFail(400, '文件为空');
  }
  if (body.length > uploadMaxBytes()) {
    rpcFail(400, `文件超过上限 ${uploadMaxBytes()} 字节`);
  }
  return { filename, contentType, prefix, body };
}
