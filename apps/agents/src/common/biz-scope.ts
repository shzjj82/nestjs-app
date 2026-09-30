import { asRecord, rpcFail } from './rpc';

/** 网关校验后注入的业务 code */
export function requireBizCode(payload: unknown): string {
  const raw = asRecord(payload)._bizCode;
  const code = typeof raw === 'string' ? raw.trim() : '';
  if (!/^[a-zA-Z][a-zA-Z0-9_-]{1,31}$/.test(code)) {
    rpcFail(400, 'INVALID_BIZ_CODE');
  }
  return code;
}
