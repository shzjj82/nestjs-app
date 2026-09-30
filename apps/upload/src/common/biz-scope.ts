import { asRecord, rpcFail } from './rpc';

/** 网关校验后注入的业务 code；上传对象按业务分目录隔离 */
export function requireBizCode(payload: unknown): string {
  const raw = asRecord(payload)._bizCode;
  const code = typeof raw === 'string' ? raw.trim() : '';
  if (!/^[a-zA-Z][a-zA-Z0-9_-]{1,31}$/.test(code)) {
    rpcFail(400, 'INVALID_BIZ_CODE');
  }
  return code;
}

export function bizPrefix(bizCode: string, prefix: string): string {
  const rest = prefix.replace(/^\/+/, '');
  return rest ? `${bizCode}/${rest}` : bizCode;
}

export function keyInBiz(bizCode: string, key: string): boolean {
  return key.startsWith(`${bizCode}/`) && !key.includes('..');
}
