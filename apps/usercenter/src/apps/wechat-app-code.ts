import { rpcFail } from '../rpc';

export function normalizeAppCode(raw: string): string {
  const code = raw.trim();
  if (!/^[a-zA-Z][a-zA-Z0-9_-]{1,31}$/.test(code)) {
    rpcFail(400, 'appCode 需为 2-32 位，字母开头，仅含字母数字和 _-');
  }
  return code;
}
