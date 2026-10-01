import {
  AGENTS_CLIENT,
  DOCS_CLIENT,
  MQTT_PATTERNS,
  ORDER_CLIENT,
  UPLOAD_CLIENT,
  USER_CLIENT,
  WECHAT_CLIENT,
} from './patterns';
import { PERMISSIONS } from './types';

export type GatewayAuth = 'jwt' | 'admin' | 'docs-key' | 'upload-key';
export type GatewayHttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * platform：仅接受 platform 业务会话（admin 控制台）；
 * business：必须携带已启用业务的 X-Biz-Code，token 需属于该业务，且业务开通了该接口；
 * 未设置：不校验业务（健康检查、登出）。
 */
export type GatewayScope = 'platform' | 'business';

export interface GatewayRoute {
  method: GatewayHttpMethod;
  path: string;
  client: string;
  pattern: string;
  auth?: GatewayAuth[];
  permissions?: string[];
  override?: boolean;
  scope?: GatewayScope;
}

export interface MatchedGatewayRoute extends GatewayRoute {
  params: Record<string, string>;
}

type RouteInput = Omit<GatewayRoute, 'scope'>;

function platform(route: RouteInput): GatewayRoute {
  return { ...route, auth: route.auth ?? ['jwt'], scope: 'platform' };
}

function business(route: RouteInput): GatewayRoute {
  return { ...route, scope: 'business' };
}

export const GATEWAY_ROUTES: GatewayRoute[] = [
  business({ method: 'POST', path: '/auth/register', client: USER_CLIENT, pattern: MQTT_PATTERNS.AUTH_REGISTER }),
  business({ method: 'POST', path: '/auth/login', client: USER_CLIENT, pattern: MQTT_PATTERNS.AUTH_LOGIN }),
  business({ method: 'POST', path: '/auth/wechat', client: USER_CLIENT, pattern: MQTT_PATTERNS.AUTH_WECHAT }),
  business({ method: 'POST', path: '/auth/alipay', client: USER_CLIENT, pattern: MQTT_PATTERNS.AUTH_ALIPAY }),
  business({ method: 'POST', path: '/auth/refresh', client: USER_CLIENT, pattern: MQTT_PATTERNS.AUTH_REFRESH }),
  { method: 'POST', path: '/auth/logout', client: USER_CLIENT, pattern: MQTT_PATTERNS.AUTH_LOGOUT },
  business({ method: 'GET', path: '/auth/me', client: USER_CLIENT, pattern: MQTT_PATTERNS.AUTH_ME, auth: ['jwt'] }),
  business({ method: 'POST', path: '/auth/bind-phone', client: USER_CLIENT, pattern: MQTT_PATTERNS.AUTH_BIND_PHONE, auth: ['jwt'] }),
  business({ method: 'POST', path: '/auth/change-password', client: USER_CLIENT, pattern: MQTT_PATTERNS.AUTH_CHANGE_PASSWORD, auth: ['jwt'] }),

  platform({ method: 'GET', path: '/users', client: USER_CLIENT, pattern: MQTT_PATTERNS.USER_FIND_ALL, permissions: [PERMISSIONS.USER_QUERY] }),
  platform({ method: 'GET', path: '/users/:id', client: USER_CLIENT, pattern: MQTT_PATTERNS.USER_FIND_ONE, permissions: [PERMISSIONS.USER_QUERY] }),
  platform({ method: 'POST', path: '/users', client: USER_CLIENT, pattern: MQTT_PATTERNS.USER_CREATE, permissions: [PERMISSIONS.USER_CREATE] }),
  platform({ method: 'PATCH', path: '/users/:id', client: USER_CLIENT, pattern: MQTT_PATTERNS.USER_UPDATE, permissions: [PERMISSIONS.USER_UPDATE] }),
  platform({ method: 'PATCH', path: '/accounts/:id', client: USER_CLIENT, pattern: MQTT_PATTERNS.ACCOUNT_UPDATE, permissions: [PERMISSIONS.USER_UPDATE] }),
  platform({ method: 'PUT', path: '/accounts/:id/roles', client: USER_CLIENT, pattern: MQTT_PATTERNS.ACCOUNT_ASSIGN_ROLES, permissions: [PERMISSIONS.USER_ASSIGN_ROLE] }),

  platform({ method: 'GET', path: '/businesses', client: USER_CLIENT, pattern: MQTT_PATTERNS.BUSINESS_FIND_ALL, permissions: [PERMISSIONS.BUSINESS_MANAGE] }),
  platform({ method: 'GET', path: '/businesses/:id', client: USER_CLIENT, pattern: MQTT_PATTERNS.BUSINESS_FIND_ONE, permissions: [PERMISSIONS.BUSINESS_MANAGE] }),
  platform({ method: 'POST', path: '/businesses', client: USER_CLIENT, pattern: MQTT_PATTERNS.BUSINESS_CREATE, permissions: [PERMISSIONS.BUSINESS_MANAGE] }),
  platform({ method: 'PATCH', path: '/businesses/:id', client: USER_CLIENT, pattern: MQTT_PATTERNS.BUSINESS_UPDATE, permissions: [PERMISSIONS.BUSINESS_MANAGE] }),
  platform({ method: 'PUT', path: '/businesses/:id/permissions', client: USER_CLIENT, pattern: MQTT_PATTERNS.BUSINESS_SET_PERMISSIONS, permissions: [PERMISSIONS.BUSINESS_MANAGE] }),
  platform({ method: 'GET', path: '/businesses/:id/members', client: USER_CLIENT, pattern: MQTT_PATTERNS.BUSINESS_MEMBER_FIND_ALL, permissions: [PERMISSIONS.BUSINESS_MANAGE] }),
  platform({ method: 'PATCH', path: '/businesses/:id/members/:memberId', client: USER_CLIENT, pattern: MQTT_PATTERNS.BUSINESS_MEMBER_UPDATE, permissions: [PERMISSIONS.BUSINESS_MANAGE] }),

  platform({ method: 'GET', path: '/clients', client: USER_CLIENT, pattern: MQTT_PATTERNS.CLIENT_FIND_ALL, permissions: [PERMISSIONS.CLIENT_MANAGE] }),
  platform({ method: 'POST', path: '/clients', client: USER_CLIENT, pattern: MQTT_PATTERNS.CLIENT_CREATE, permissions: [PERMISSIONS.CLIENT_MANAGE] }),
  platform({ method: 'PATCH', path: '/clients/:id', client: USER_CLIENT, pattern: MQTT_PATTERNS.CLIENT_UPDATE, permissions: [PERMISSIONS.CLIENT_MANAGE] }),

  platform({ method: 'GET', path: '/roles', client: USER_CLIENT, pattern: MQTT_PATTERNS.ROLE_FIND_ALL, permissions: [PERMISSIONS.ROLE_MANAGE] }),
  platform({ method: 'POST', path: '/roles', client: USER_CLIENT, pattern: MQTT_PATTERNS.ROLE_CREATE, permissions: [PERMISSIONS.ROLE_MANAGE] }),
  platform({ method: 'PATCH', path: '/roles/:id', client: USER_CLIENT, pattern: MQTT_PATTERNS.ROLE_UPDATE, permissions: [PERMISSIONS.ROLE_MANAGE] }),
  platform({ method: 'DELETE', path: '/roles/:id', client: USER_CLIENT, pattern: MQTT_PATTERNS.ROLE_DELETE, permissions: [PERMISSIONS.ROLE_MANAGE] }),
  platform({ method: 'PUT', path: '/roles/:id/permissions', client: USER_CLIENT, pattern: MQTT_PATTERNS.ROLE_SET_PERMISSIONS, permissions: [PERMISSIONS.ROLE_MANAGE] }),

  platform({ method: 'GET', path: '/permissions/export', client: USER_CLIENT, pattern: MQTT_PATTERNS.PERMISSION_EXPORT, permissions: [PERMISSIONS.PERMISSION_EXPORT], override: true }),
  platform({ method: 'POST', path: '/permissions/import', client: USER_CLIENT, pattern: MQTT_PATTERNS.PERMISSION_IMPORT, permissions: [PERMISSIONS.PERMISSION_IMPORT], override: true }),
  platform({ method: 'GET', path: '/permissions', client: USER_CLIENT, pattern: MQTT_PATTERNS.PERMISSION_FIND_ALL, permissions: [PERMISSIONS.PERMISSION_MANAGE] }),
  platform({ method: 'POST', path: '/permissions', client: USER_CLIENT, pattern: MQTT_PATTERNS.PERMISSION_CREATE, permissions: [PERMISSIONS.PERMISSION_MANAGE] }),
  platform({ method: 'PATCH', path: '/permissions/:id', client: USER_CLIENT, pattern: MQTT_PATTERNS.PERMISSION_UPDATE, permissions: [PERMISSIONS.PERMISSION_MANAGE] }),
  platform({ method: 'DELETE', path: '/permissions/:id', client: USER_CLIENT, pattern: MQTT_PATTERNS.PERMISSION_DELETE, permissions: [PERMISSIONS.PERMISSION_MANAGE] }),

  business({ method: 'GET', path: '/teams', client: USER_CLIENT, pattern: MQTT_PATTERNS.TEAM_FIND_ALL, auth: ['jwt'] }),
  business({ method: 'POST', path: '/teams', client: USER_CLIENT, pattern: MQTT_PATTERNS.TEAM_CREATE, auth: ['jwt'] }),
  business({ method: 'GET', path: '/teams/:id', client: USER_CLIENT, pattern: MQTT_PATTERNS.TEAM_FIND_ONE, auth: ['jwt'] }),
  business({ method: 'POST', path: '/teams/:id/join', client: USER_CLIENT, pattern: MQTT_PATTERNS.TEAM_JOIN, auth: ['jwt'] }),
  business({ method: 'POST', path: '/teams/:id/leave', client: USER_CLIENT, pattern: MQTT_PATTERNS.TEAM_LEAVE, auth: ['jwt'] }),
  business({ method: 'PATCH', path: '/teams/:id/members/:accountId', client: USER_CLIENT, pattern: MQTT_PATTERNS.TEAM_MEMBER_UPDATE, auth: ['jwt'] }),

  business({ method: 'GET', path: '/orders', client: ORDER_CLIENT, pattern: MQTT_PATTERNS.ORDER_FIND_ALL }),
  business({ method: 'GET', path: '/orders/:id', client: ORDER_CLIENT, pattern: MQTT_PATTERNS.ORDER_FIND_ONE }),
  business({ method: 'POST', path: '/orders', client: ORDER_CLIENT, pattern: MQTT_PATTERNS.ORDER_CREATE, override: true }),

  ...docsContentRoutes('/docs/documents'),
  { method: 'GET', path: '/docs/health', client: DOCS_CLIENT, pattern: MQTT_PATTERNS.DOC_HEALTH },
  business({ method: 'GET', path: '/docs/categories', client: DOCS_CLIENT, pattern: MQTT_PATTERNS.DOC_CATEGORY_FIND_ALL }),
  business({ method: 'GET', path: '/docs/categories/:slug', client: DOCS_CLIENT, pattern: MQTT_PATTERNS.DOC_CATEGORY_FIND_SLUG }),
  business({ method: 'POST', path: '/docs/categories', client: DOCS_CLIENT, pattern: MQTT_PATTERNS.DOC_CATEGORY_CREATE, auth: ['jwt', 'docs-key'] }),
  business({ method: 'PUT', path: '/docs/categories/:id', client: DOCS_CLIENT, pattern: MQTT_PATTERNS.DOC_CATEGORY_UPDATE, auth: ['jwt', 'docs-key'] }),
  business({ method: 'DELETE', path: '/docs/categories/:id', client: DOCS_CLIENT, pattern: MQTT_PATTERNS.DOC_CATEGORY_DELETE, auth: ['jwt', 'docs-key'] }),

  business({ method: 'POST', path: '/upload', client: UPLOAD_CLIENT, pattern: MQTT_PATTERNS.UPLOAD_PUT, auth: ['jwt', 'upload-key'], override: true }),
  business({ method: 'POST', path: '/upload/async', client: UPLOAD_CLIENT, pattern: MQTT_PATTERNS.UPLOAD_ENQUEUE, auth: ['jwt', 'upload-key'], override: true }),
  { method: 'GET', path: '/upload/health', client: UPLOAD_CLIENT, pattern: MQTT_PATTERNS.UPLOAD_HEALTH },
  business({ method: 'GET', path: '/upload/jobs/:id', client: UPLOAD_CLIENT, pattern: MQTT_PATTERNS.UPLOAD_JOB, auth: ['jwt', 'upload-key'] }),
  business({ method: 'DELETE', path: '/upload/objects', client: UPLOAD_CLIENT, pattern: MQTT_PATTERNS.UPLOAD_DELETE, auth: ['jwt', 'upload-key'] }),

  { method: 'GET', path: '/wechat/health', client: WECHAT_CLIENT, pattern: MQTT_PATTERNS.WECHAT_HEALTH },
  platform({ method: 'GET', path: '/wechat/miniprograms', client: WECHAT_CLIENT, pattern: MQTT_PATTERNS.WECHAT_MP_FIND_ALL, permissions: [PERMISSIONS.WECHAT_MANAGE] }),
  platform({ method: 'POST', path: '/wechat/miniprograms', client: WECHAT_CLIENT, pattern: MQTT_PATTERNS.WECHAT_MP_CREATE, permissions: [PERMISSIONS.WECHAT_MANAGE] }),
  platform({ method: 'PATCH', path: '/wechat/miniprograms/:id', client: WECHAT_CLIENT, pattern: MQTT_PATTERNS.WECHAT_MP_UPDATE, permissions: [PERMISSIONS.WECHAT_MANAGE] }),
  platform({ method: 'DELETE', path: '/wechat/miniprograms/:id', client: WECHAT_CLIENT, pattern: MQTT_PATTERNS.WECHAT_MP_DELETE, permissions: [PERMISSIONS.WECHAT_MANAGE] }),
  platform({ method: 'POST', path: '/wechat/qrcode', client: WECHAT_CLIENT, pattern: MQTT_PATTERNS.WECHAT_QRCODE, permissions: [PERMISSIONS.WECHAT_QRCODE], override: true }),
  business({ method: 'POST', path: '/wechat/phone', client: WECHAT_CLIENT, pattern: MQTT_PATTERNS.WECHAT_PHONE, auth: ['jwt'] }),

  { method: 'GET', path: '/agents/health', client: AGENTS_CLIENT, pattern: MQTT_PATTERNS.AGENTS_HEALTH },
  business({ method: 'GET', path: '/agents/chat/status', client: AGENTS_CLIENT, pattern: MQTT_PATTERNS.AGENTS_CHAT_STATUS, auth: ['jwt'] }),
  business({ method: 'POST', path: '/agents/chat', client: AGENTS_CLIENT, pattern: MQTT_PATTERNS.AGENTS_CHAT, auth: ['jwt'], override: true }),
  business({ method: 'POST', path: '/agents/vision', client: AGENTS_CLIENT, pattern: MQTT_PATTERNS.AGENTS_VISION_PARSE, auth: ['jwt'], override: true }),
];

function docsContentRoutes(prefix: '/docs/documents'): GatewayRoute[] {
  const auth: GatewayAuth[] = ['jwt', 'docs-key'];
  const docs = (route: Omit<RouteInput, 'client'>) =>
    business({ ...route, client: DOCS_CLIENT });
  return [
    docs({ method: 'GET', path: `${prefix}/id/:id`, pattern: MQTT_PATTERNS.DOC_POST_FIND_ID, auth }),
    docs({ method: 'POST', path: `${prefix}/id/:id/children`, pattern: MQTT_PATTERNS.DOC_POST_CHILDREN, auth }),
    docs({ method: 'PUT', path: `${prefix}/id/:id/parent`, pattern: MQTT_PATTERNS.DOC_POST_REPARENT, auth }),
    docs({ method: 'GET', path: prefix, pattern: MQTT_PATTERNS.DOC_POST_FIND_ALL }),
    docs({ method: 'GET', path: `${prefix}/:slug`, pattern: MQTT_PATTERNS.DOC_POST_FIND_SLUG }),
    docs({ method: 'POST', path: prefix, pattern: MQTT_PATTERNS.DOC_POST_CREATE, auth }),
    docs({ method: 'PUT', path: `${prefix}/:id`, pattern: MQTT_PATTERNS.DOC_POST_UPDATE, auth }),
    docs({ method: 'DELETE', path: `${prefix}/:id`, pattern: MQTT_PATTERNS.DOC_POST_DELETE, auth }),
  ];
}

/** 业务开通接口时存的标识，如 `POST /auth/register` */
export function routeKey(route: Pick<GatewayRoute, 'method' | 'path'>): string {
  return `${route.method} ${route.path}`;
}

/** 各微服务应答接口文档（@ApiDoc）的 pattern */
export const SERVICE_API_DOCS: Array<{ client: string; service: string; pattern: string }> = [
  { client: USER_CLIENT, service: 'usercenter', pattern: MQTT_PATTERNS.USER_API_DOCS },
  { client: DOCS_CLIENT, service: 'docs', pattern: MQTT_PATTERNS.DOC_API_DOCS },
  { client: UPLOAD_CLIENT, service: 'upload', pattern: MQTT_PATTERNS.UPLOAD_API_DOCS },
  { client: ORDER_CLIENT, service: 'order', pattern: MQTT_PATTERNS.ORDER_API_DOCS },
  { client: WECHAT_CLIENT, service: 'wechat', pattern: MQTT_PATTERNS.WECHAT_API_DOCS },
  { client: AGENTS_CLIENT, service: 'agents', pattern: MQTT_PATTERNS.AGENTS_API_DOCS },
];

export interface BizApiCatalogItem {
  key: string;
  name: string;
  description: string | null;
  method: GatewayHttpMethod;
  path: string;
}

export interface BizServiceCatalogItem {
  service: string;
  label: string;
  /** 服务未应答时为 false，接口名称退化为 routeKey */
  online: boolean;
  apis: BizApiCatalogItem[];
}

export function bizApiKeys(): string[] {
  return GATEWAY_ROUTES.filter((route) => route.scope === 'business').map(routeKey);
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
