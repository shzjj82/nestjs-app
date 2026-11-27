import { RequestMethod } from '@nestjs/common';
import type { RouteInfo } from '@nestjs/common/interfaces';
import { microserviceProxyPrefixes, type AuthSession } from '@app/common';

export const LOCAL_PATHS = new Set(['/', '/health']);

/** 跨服务 / 特殊入口：不跟单一微服务前缀一一对应 */
const SHARED_PROXY_PREFIXES = ['auth'] as const;

function proxyPathsFor(prefix: string): RouteInfo[] {
  return [
    { path: prefix, method: RequestMethod.ALL },
    { path: `${prefix}/{*path}`, method: RequestMethod.ALL },
  ];
}

export const PROXY_HTTP_PATHS: RouteInfo[] = [
  ...SHARED_PROXY_PREFIXES.flatMap(proxyPathsFor),
  ...microserviceProxyPrefixes().flatMap(proxyPathsFor),
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
    _wikiPrivileged: _ignoredWikiPrivileged,
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
    _wikiPrivileged: false,
  };
}

export const APP_CODE_HEADER = 'x-app-code';

/** 应用 code 只从请求头 X-App-Code 读取 */
export function requestAppCode(req: { headers?: Record<string, unknown> }): string | null {
  const raw = req.headers?.[APP_CODE_HEADER];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
