import { DOCS_CLIENT, MQTT_PATTERNS, ORDER_CLIENT, USER_CLIENT } from './patterns';
import { PERMISSIONS } from './types';

export type GatewayAuth = 'jwt' | 'admin' | 'docs-key';
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
    path: '/auth/alipay',
    client: USER_CLIENT,
    pattern: MQTT_PATTERNS.AUTH_ALIPAY,
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
    method: 'POST',
    path: '/auth/bind-phone',
    client: USER_CLIENT,
    pattern: MQTT_PATTERNS.AUTH_BIND_PHONE,
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
    method: 'PUT',
    path: '/users/:id/roles',
    client: USER_CLIENT,
    pattern: MQTT_PATTERNS.USER_ASSIGN_ROLES,
    auth: ['jwt'],
    permissions: [PERMISSIONS.USER_ASSIGN_ROLE],
  },
  {
    method: 'GET',
    path: '/clients',
    client: USER_CLIENT,
    pattern: MQTT_PATTERNS.CLIENT_FIND_ALL,
    auth: ['jwt'],
    permissions: [PERMISSIONS.CLIENT_MANAGE],
  },
  {
    method: 'POST',
    path: '/clients',
    client: USER_CLIENT,
    pattern: MQTT_PATTERNS.CLIENT_CREATE,
    auth: ['jwt'],
    permissions: [PERMISSIONS.CLIENT_MANAGE],
  },
  {
    method: 'PATCH',
    path: '/clients/:id',
    client: USER_CLIENT,
    pattern: MQTT_PATTERNS.CLIENT_UPDATE,
    auth: ['jwt'],
    permissions: [PERMISSIONS.CLIENT_MANAGE],
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
  ...docsContentRoutes('/docs/posts'),
  ...docsContentRoutes('/docs/documents'),
  {
    method: 'GET',
    path: '/docs/health',
    client: DOCS_CLIENT,
    pattern: MQTT_PATTERNS.DOC_HEALTH,
  },
  {
    method: 'GET',
    path: '/docs/categories',
    client: DOCS_CLIENT,
    pattern: MQTT_PATTERNS.DOC_CATEGORY_FIND_ALL,
  },
  {
    method: 'GET',
    path: '/docs/categories/:slug',
    client: DOCS_CLIENT,
    pattern: MQTT_PATTERNS.DOC_CATEGORY_FIND_SLUG,
  },
  {
    method: 'POST',
    path: '/docs/categories',
    client: DOCS_CLIENT,
    pattern: MQTT_PATTERNS.DOC_CATEGORY_CREATE,
    auth: ['jwt', 'docs-key'],
  },
  {
    method: 'PUT',
    path: '/docs/categories/:id',
    client: DOCS_CLIENT,
    pattern: MQTT_PATTERNS.DOC_CATEGORY_UPDATE,
    auth: ['jwt', 'docs-key'],
  },
  {
    method: 'DELETE',
    path: '/docs/categories/:id',
    client: DOCS_CLIENT,
    pattern: MQTT_PATTERNS.DOC_CATEGORY_DELETE,
    auth: ['jwt', 'docs-key'],
  },
  {
    method: 'GET',
    path: '/docs/site',
    client: DOCS_CLIENT,
    pattern: MQTT_PATTERNS.DOC_SITE_GET,
  },
  {
    method: 'PUT',
    path: '/docs/site',
    client: DOCS_CLIENT,
    pattern: MQTT_PATTERNS.DOC_SITE_SAVE,
    auth: ['jwt', 'docs-key'],
  },
];

function docsContentRoutes(prefix: '/docs/posts' | '/docs/documents'): GatewayRoute[] {
  const auth: GatewayAuth[] = ['jwt', 'docs-key'];
  return [
    {
      method: 'GET',
      path: `${prefix}/workspace/specials`,
      client: DOCS_CLIENT,
      pattern: MQTT_PATTERNS.DOC_POST_SPECIALS,
      auth,
    },
    {
      method: 'GET',
      path: `${prefix}/id/:id`,
      client: DOCS_CLIENT,
      pattern: MQTT_PATTERNS.DOC_POST_FIND_ID,
      auth,
    },
    {
      method: 'POST',
      path: `${prefix}/id/:id/children`,
      client: DOCS_CLIENT,
      pattern: MQTT_PATTERNS.DOC_POST_CHILDREN,
      auth,
    },
    {
      method: 'PUT',
      path: `${prefix}/id/:id/parent`,
      client: DOCS_CLIENT,
      pattern: MQTT_PATTERNS.DOC_POST_REPARENT,
      auth,
    },
    {
      method: 'GET',
      path: prefix,
      client: DOCS_CLIENT,
      pattern: MQTT_PATTERNS.DOC_POST_FIND_ALL,
    },
    {
      method: 'GET',
      path: `${prefix}/:slug`,
      client: DOCS_CLIENT,
      pattern: MQTT_PATTERNS.DOC_POST_FIND_SLUG,
    },
    {
      method: 'POST',
      path: prefix,
      client: DOCS_CLIENT,
      pattern: MQTT_PATTERNS.DOC_POST_CREATE,
      auth,
    },
    {
      method: 'PUT',
      path: `${prefix}/:id`,
      client: DOCS_CLIENT,
      pattern: MQTT_PATTERNS.DOC_POST_UPDATE,
      auth,
    },
    {
      method: 'DELETE',
      path: `${prefix}/:id`,
      client: DOCS_CLIENT,
      pattern: MQTT_PATTERNS.DOC_POST_DELETE,
      auth,
    },
  ];
}

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
