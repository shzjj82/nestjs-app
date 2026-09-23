import { RequestMethod } from '@nestjs/common';
import type { RouteInfo } from '@nestjs/common/interfaces';
import type { AuthSession } from '@app/common';

export const LOCAL_PATHS = new Set(['/', '/health']);

export const PROXY_HTTP_PATHS: RouteInfo[] = [
  { path: 'auth', method: RequestMethod.ALL },
  { path: 'auth/{*path}', method: RequestMethod.ALL },
  { path: 'users', method: RequestMethod.ALL },
  { path: 'users/{*path}', method: RequestMethod.ALL },
  { path: 'apps', method: RequestMethod.ALL },
  { path: 'apps/{*path}', method: RequestMethod.ALL },
  { path: 'roles', method: RequestMethod.ALL },
  { path: 'roles/{*path}', method: RequestMethod.ALL },
  { path: 'permissions', method: RequestMethod.ALL },
  { path: 'permissions/{*path}', method: RequestMethod.ALL },
  { path: 'orders', method: RequestMethod.ALL },
  { path: 'orders/{*path}', method: RequestMethod.ALL },
];

export function requestPathname(req: { path?: string; url: string }): string {
  const pathname = req.path ?? req.url.split('?')[0];
  return pathname === '' ? '/' : pathname;
}

export function buildProxyPayload(
  req: { query?: unknown; body?: unknown },
  params: Record<string, string>,
  session?: AuthSession | null,
  token?: string | null,
) {
  const query = (req.query ?? {}) as Record<string, unknown>;
  const body =
    typeof req.body === 'object' && req.body !== null
      ? (req.body as Record<string, unknown>)
      : {};
  const merged = { ...query, ...body, ...params };
  const { _session: _ignoredSession, _token: _ignoredToken, ...rest } = merged;
  return {
    ...rest,
    appId: rest.appId ?? session?.appId,
    _session: session ?? null,
    _token: token ?? null,
  };
}
