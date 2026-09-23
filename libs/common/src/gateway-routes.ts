import { MQTT_PATTERNS, ORDER_CLIENT, USER_CLIENT } from './patterns';

export type GatewayAuth = 'jwt' | 'admin';
export type GatewayHttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface GatewayRoute {
  method: GatewayHttpMethod;
  path: string;
  client: string;
  pattern: string;
  auth?: GatewayAuth[];
  override?: boolean;
}

export interface MatchedGatewayRoute extends GatewayRoute {
  params: Record<string, string>;
}

export const GATEWAY_ROUTES: GatewayRoute[] = [
  {
    method: 'GET',
    path: '/users',
    client: USER_CLIENT,
    pattern: MQTT_PATTERNS.USER_FIND_ALL,
  },
  {
    method: 'GET',
    path: '/users/:id',
    client: USER_CLIENT,
    pattern: MQTT_PATTERNS.USER_FIND_ONE,
  },
  {
    method: 'POST',
    path: '/users',
    client: USER_CLIENT,
    pattern: MQTT_PATTERNS.USER_CREATE,
    auth: ['jwt'],
  },
  {
    method: 'GET',
    path: '/orders',
    client: ORDER_CLIENT,
    pattern: MQTT_PATTERNS.ORDER_FIND_ALL,
  },
  {
    method: 'GET',
    path: '/orders/:id',
    client: ORDER_CLIENT,
    pattern: MQTT_PATTERNS.ORDER_FIND_ONE,
  },
  {
    method: 'POST',
    path: '/orders',
    client: ORDER_CLIENT,
    pattern: MQTT_PATTERNS.ORDER_CREATE,
    override: true,
  },
];

export function normalizePath(path: string): string {
  if (!path || path === '/') {
    return '/';
  }
  return path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
}

export function matchRoute(
  method: string,
  pathname: string,
): MatchedGatewayRoute | null {
  const verb = method.toUpperCase();
  const current = normalizePath(pathname);

  for (const route of GATEWAY_ROUTES) {
    if (route.method !== verb) {
      continue;
    }
    const params = matchPath(route.path, current);
    if (params) {
      return { ...route, params };
    }
  }
  return null;
}

function matchPath(
  pattern: string,
  pathname: string,
): Record<string, string> | null {
  const patternParts = normalizePath(pattern).split('/').filter(Boolean);
  const pathParts = pathname.split('/').filter(Boolean);
  if (patternParts.length !== pathParts.length) {
    return null;
  }

  const params: Record<string, string> = {};
  for (let i = 0; i < patternParts.length; i += 1) {
    const token = patternParts[i];
    const value = pathParts[i];
    if (token.startsWith(':')) {
      params[token.slice(1)] = decodeURIComponent(value);
      continue;
    }
    if (token !== value) {
      return null;
    }
  }
  return params;
}
