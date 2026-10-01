import { RequestMethod } from '@nestjs/common';
import type { RouteInfo } from '@nestjs/common/interfaces';
import type { AuthSession } from '@app/common';

export const LOCAL_PATHS = new Set(['/', '/health']);

export const PROXY_HTTP_PATHS: RouteInfo[] = [
  { path: 'auth', method: RequestMethod.ALL },
  { path: 'auth/{*path}', method: RequestMethod.ALL },
  { path: 'users', method: RequestMethod.ALL },
  { path: 'users/{*path}', method: RequestMethod.ALL },
  { path: 'accounts/{*path}', method: RequestMethod.ALL },
  { path: 'businesses', method: RequestMethod.ALL },
  { path: 'businesses/{*path}', method: RequestMethod.ALL },
  { path: 'teams', method: RequestMethod.ALL },
  { path: 'teams/{*path}', method: RequestMethod.ALL },
  { path: 'clients', method: RequestMethod.ALL },
  { path: 'clients/{*path}', method: RequestMethod.ALL },
  { path: 'docs', method: RequestMethod.ALL },
  { path: 'docs/{*path}', method: RequestMethod.ALL },
  { path: 'roles', method: RequestMethod.ALL },
  { path: 'roles/{*path}', method: RequestMethod.ALL },
  { path: 'permissions', method: RequestMethod.ALL },
  { path: 'permissions/{*path}', method: RequestMethod.ALL },
  { path: 'orders', method: RequestMethod.ALL },
  { path: 'orders/{*path}', method: RequestMethod.ALL },
  { path: 'upload', method: RequestMethod.ALL },
  { path: 'upload/{*path}', method: RequestMethod.ALL },
  { path: 'wechat', method: RequestMethod.ALL },
  { path: 'wechat/{*path}', method: RequestMethod.ALL },
  { path: 'agents', method: RequestMethod.ALL },
  { path: 'agents/{*path}', method: RequestMethod.ALL },
];

export function requestPathname(req: { path?: string; url: string }): string {
  const pathname = req.path ?? req.url.split('?')[0];
  return pathname === '' ? '/' : pathname;
}

/**
 * 业务 code 只认网关校验后的 _bizCode。
 * appCode 只认请求头 X-App-Code 注入的 _appCode；查询参数和 body 里的 appCode 一律丢弃。
 */
export function buildProxyPayload(
  req: { query?: unknown; body?: unknown },
  params: Record<string, string>,
  session?: AuthSession | null,
  token?: string | null,
  bizCode?: string | null,
  appCode?: string | null,
) {
  const query = (req.query ?? {}) as Record<string, unknown>;
  const body =
    typeof req.body === 'object' && req.body !== null
      ? (req.body as Record<string, unknown>)
      : {};
  const merged = { ...query, ...body, ...params };
  const {
    _session: _ignoredSession,
    _token: _ignoredToken,
    _bizCode: _ignoredBizCode,
    _appCode: _ignoredAppCodeField,
    _docsPrivileged: _ignoredPrivileged,
    appCode: _ignoredAppCode,
    ...rest
  } = merged;
  return {
    ...rest,
    appId: rest.appId ?? session?.appId,
    _session: session ?? null,
    _token: token ?? null,
    _bizCode: bizCode ?? null,
    _appCode: appCode ?? null,
    _docsPrivileged: false,
  };
}

export const APP_CODE_HEADER = 'x-app-code';

/** 应用 code 只从请求头 X-App-Code 读取 */
export function requestAppCode(req: { headers?: Record<string, unknown> }): string | null {
  const raw = req.headers?.[APP_CODE_HEADER];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
