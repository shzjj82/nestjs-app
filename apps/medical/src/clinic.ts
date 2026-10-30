/* eslint-disable @typescript-eslint/no-explicit-any */
import { rpcFail } from '@app/common';
import type { AuthService } from './modules/auth/auth.service';
import type { TokenUser } from './modules/auth/token';

export function tokenOf(payload: Record<string, unknown>): string {
  const raw = payload._token;
  return typeof raw === 'string' ? raw.trim() : '';
}

/** 诊所账号（医生 / 医助）登录态，走 medical 自己的 token，不是 usercenter JWT。 */
export async function requireClinic(
  auth: AuthService,
  payload: Record<string, unknown>,
): Promise<TokenUser> {
  const session = auth.fromToken(tokenOf(payload));
  if (!session) rpcFail(401, '请先登录');
  return auth.profile(session.id);
}

export function optionalNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

const META_KEYS = new Set([
  '_session',
  '_token',
  '_bizCode',
  '_appCode',
  '_docsPrivileged',
  'appId',
]);

/** 去掉网关注入字段，得到业务 body。 */
export function clinicBody(
  payload: Record<string, unknown>,
  extraKeys: string[] = [],
): Record<string, any> {
  const skip = new Set([...META_KEYS, ...extraKeys]);
  const rest: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (!skip.has(key)) rest[key] = value;
  }
  return rest;
}
