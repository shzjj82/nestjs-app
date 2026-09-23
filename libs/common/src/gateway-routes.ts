import { MQTT_PATTERNS, ORDER_CLIENT, USER_CLIENT } from './patterns';
import { PERMISSIONS } from './types';

export type GatewayAuth = 'jwt' | 'admin';
export type GatewayHttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface GatewayRoute {
  method: GatewayHttpMethod;
  path: string;
  client: string;
  pattern: string;
  auth?: GatewayAuth[];
  permissions?: string[];
  override?: boolean;
}

export interface MatchedGatewayRoute extends GatewayRoute {
  params: Record<string, string>;
}

export const GATEWAY_ROUTES: GatewayRoute[] = [
  {
    method: 'POST',
    path: '/auth/register',
    client: USER_CLIENT,
    pattern: MQTT_PATTERNS.AUTH_REGISTER,
  },
  {
    method: 'POST',
    path: '/auth/login',
    client: USER_CLIENT,
    pattern: MQTT_PATTERNS.AUTH_LOGIN,
  },
  {
    method: 'POST',
    path: '/auth/wechat',
    client: USER_CLIENT,
    pattern: MQTT_PATTERNS.AUTH_WECHAT,
  },
  {
    method: 'POST',
    path: '/auth/refresh',
    client: USER_CLIENT,
    pattern: MQTT_PATTERNS.AUTH_REFRESH,
  },
  {
    method: 'POST',
    path: '/auth/logout',
    client: USER_CLIENT,
    pattern: MQTT_PATTERNS.AUTH_LOGOUT,
  },
  {
    method: 'GET',
    path: '/auth/me',
    client: USER_CLIENT,
    pattern: MQTT_PATTERNS.AUTH_ME,
    auth: ['jwt'],
  },
  {
    method: 'GET',
    path: '/users',
    client: USER_CLIENT,
    pattern: MQTT_PATTERNS.USER_FIND_ALL,
    auth: ['jwt'],
    permissions: [PERMISSIONS.USER_QUERY],
  },
  {
    method: 'GET',
    path: '/users/:id',
    client: USER_CLIENT,
    pattern: MQTT_PATTERNS.USER_FIND_ONE,
    auth: ['jwt'],
    permissions: [PERMISSIONS.USER_QUERY],
  },
  {
    method: 'POST',
    path: '/users',
    client: USER_CLIENT,
    pattern: MQTT_PATTERNS.USER_CREATE,
    auth: ['jwt'],
    permissions: [PERMISSIONS.USER_CREATE],
  },
  {
    method: 'PATCH',
    path: '/users/:id',
    client: USER_CLIENT,
    pattern: MQTT_PATTERNS.USER_UPDATE,
    auth: ['jwt'],
    permissions: [PERMISSIONS.USER_UPDATE],
  },
  {
    method: 'POST',
    path: '/users/:id/apps',
    client: USER_CLIENT,
    pattern: MQTT_PATTERNS.USER_BIND_APP,
    auth: ['jwt'],
    permissions: [PERMISSIONS.USER_BIND_APP],
  },
  {
    method: 'PUT',
    path: '/users/:id/roles',
    client: USER_CLIENT,
    pattern: MQTT_PATTERNS.USER_ASSIGN_ROLES,
    auth: ['jwt'],
    permissions: [PERMISSIONS.USER_ASSIGN_ROLE],
  },
  {
    method: 'GET',
    path: '/apps',
    client: USER_CLIENT,
    pattern: MQTT_PATTERNS.APP_FIND_ALL,
    auth: ['jwt'],
    permissions: [PERMISSIONS.APP_MANAGE],
  },
  {
    method: 'POST',
    path: '/apps',
    client: USER_CLIENT,
    pattern: MQTT_PATTERNS.APP_CREATE,
    auth: ['jwt'],
    permissions: [PERMISSIONS.APP_MANAGE],
  },
  {
    method: 'PATCH',
    path: '/apps/:id',
    client: USER_CLIENT,
    pattern: MQTT_PATTERNS.APP_UPDATE,
    auth: ['jwt'],
    permissions: [PERMISSIONS.APP_MANAGE],
  },
  {
    method: 'GET',
    path: '/roles',
    client: USER_CLIENT,
    pattern: MQTT_PATTERNS.ROLE_FIND_ALL,
    auth: ['jwt'],
    permissions: [PERMISSIONS.ROLE_MANAGE],
  },
  {
    method: 'POST',
    path: '/roles',
    client: USER_CLIENT,
    pattern: MQTT_PATTERNS.ROLE_CREATE,
    auth: ['jwt'],
    permissions: [PERMISSIONS.ROLE_MANAGE],
  },
  {
    method: 'PATCH',
    path: '/roles/:id',
    client: USER_CLIENT,
    pattern: MQTT_PATTERNS.ROLE_UPDATE,
    auth: ['jwt'],
    permissions: [PERMISSIONS.ROLE_MANAGE],
  },
  {
    method: 'DELETE',
    path: '/roles/:id',
    client: USER_CLIENT,
    pattern: MQTT_PATTERNS.ROLE_DELETE,
    auth: ['jwt'],
    permissions: [PERMISSIONS.ROLE_MANAGE],
  },
  {
    method: 'PUT',
    path: '/roles/:id/permissions',
    client: USER_CLIENT,
    pattern: MQTT_PATTERNS.ROLE_SET_PERMISSIONS,
    auth: ['jwt'],
    permissions: [PERMISSIONS.ROLE_MANAGE],
  },
  {
    method: 'GET',
    path: '/permissions/export',
    client: USER_CLIENT,
    pattern: MQTT_PATTERNS.PERMISSION_EXPORT,
    auth: ['jwt'],
    permissions: [PERMISSIONS.PERMISSION_EXPORT],
    override: true,
  },
  {
    method: 'POST',
    path: '/permissions/import',
    client: USER_CLIENT,
    pattern: MQTT_PATTERNS.PERMISSION_IMPORT,
    auth: ['jwt'],
    permissions: [PERMISSIONS.PERMISSION_IMPORT],
    override: true,
  },
  {
    method: 'GET',
    path: '/permissions',
    client: USER_CLIENT,
    pattern: MQTT_PATTERNS.PERMISSION_FIND_ALL,
    auth: ['jwt'],
    permissions: [PERMISSIONS.PERMISSION_MANAGE],
  },
  {
    method: 'POST',
    path: '/permissions',
    client: USER_CLIENT,
    pattern: MQTT_PATTERNS.PERMISSION_CREATE,
    auth: ['jwt'],
    permissions: [PERMISSIONS.PERMISSION_MANAGE],
  },
  {
    method: 'PATCH',
    path: '/permissions/:id',
    client: USER_CLIENT,
    pattern: MQTT_PATTERNS.PERMISSION_UPDATE,
    auth: ['jwt'],
    permissions: [PERMISSIONS.PERMISSION_MANAGE],
  },
  {
    method: 'DELETE',
    path: '/permissions/:id',
    client: USER_CLIENT,
    pattern: MQTT_PATTERNS.PERMISSION_DELETE,
    auth: ['jwt'],
    permissions: [PERMISSIONS.PERMISSION_MANAGE],
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
