import { rpcFail } from './rpc';

const APP_CODE = /^[a-zA-Z][a-zA-Z0-9_-]{1,31}$/;

/**
 * 应用 code 优先认网关注入的 _appCode（请求头 X-App-Code）。
 * 未传该头时，沿用 _bizCode（请求头 X-Biz-Code），兼容只按业务隔离的调用。
 */
export function resolveAppCode(payload: Record<string, unknown>): string {
  if (typeof payload._appCode === 'string' && payload._appCode.trim()) {
    return requireCode(payload._appCode, 'INVALID_APP_CODE');
  }
  return requireCode(payload._bizCode, 'INVALID_BIZ_CODE');
}

function requireCode(raw: unknown, message: string): string {
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (!value || !APP_CODE.test(value)) {
    rpcFail(400, message);
  }
  return value;
}
