import { rpcFail } from './rpc';

/** 业务 code 只认网关校验后注入的 _bizCode（请求头 X-Biz-Code），不接受调用方自带 appCode。 */
export function resolveAppCode(payload: Record<string, unknown>): string {
  const raw = payload._bizCode;
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (!value || !/^[a-zA-Z][a-zA-Z0-9_-]{1,31}$/.test(value)) {
    rpcFail(400, 'INVALID_BIZ_CODE');
  }
  return value;
}
