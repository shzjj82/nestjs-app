import { RequestMethod } from '@nestjs/common';
import type { RouteInfo } from '@nestjs/common/interfaces';

export const LOCAL_PATHS = new Set(['/', '/health']);

export const PROXY_HTTP_PATHS: RouteInfo[] = [
  { path: 'users', method: RequestMethod.ALL },
  { path: 'users/{*path}', method: RequestMethod.ALL },
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
) {
  const query = (req.query ?? {}) as Record<string, unknown>;
  const body =
    typeof req.body === 'object' && req.body !== null
      ? (req.body as Record<string, unknown>)
      : {};
  return { ...query, ...body, ...params };
}
