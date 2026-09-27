import { rpcFail } from './rpc';

/** 调用方必须显式传入应用编码，本服务不设默认租户。 */
export function resolveAppCode(raw?: string | null): string {
  const value = (raw ?? '').trim();
  if (!value || !/^[a-zA-Z][a-zA-Z0-9_-]{1,31}$/.test(value)) {
    rpcFail(400, 'INVALID_APP_CODE');
  }
  return value;
}
