import { rpcFail } from './rpc';

/** 未传 appCode 时归到博客，兼容现有调用方 */
export const DEFAULT_APP_CODE = 'blog';

export function resolveAppCode(raw?: string | null): string {
  const value = (raw ?? '').trim();
  if (!value) {
    return DEFAULT_APP_CODE;
  }
  if (!/^[a-zA-Z][a-zA-Z0-9_-]{1,31}$/.test(value)) {
    rpcFail(400, 'INVALID_APP_CODE');
  }
  return value;
}
