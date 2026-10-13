import { GATEWAY_ROUTES, routeKey, type GatewayHttpMethod } from './gateway-routes';
import { PERMISSIONS } from './types';

/**
 * 功能点用途（内部值仍用 platform/business）：
 * - platform：角色权限，给后台角色勾选
 * - business：开通模块，给租户白名单
 */
export type FeatureScope = 'platform' | 'business';

export interface FeatureCatalogItem {
  scope: FeatureScope;
  module: string;
  code: string;
  name: string;
  description: string;
  sort: number;
  /** 网关路由键，如 `GET /users`；一个功能点可绑定多个接口 */
  apis: string[];
  /**
   * 仅超级管理员拥有：不在功能点列表/角色勾选中展示，
   * 也不可分配给其他角色（由 seed 固定挂到 admin）。
   */
  adminOnly?: boolean;
}

const platformMeta: Array<Omit<FeatureCatalogItem, 'scope' | 'apis'>> = [
  { module: '用户中心', code: PERMISSIONS.USER_QUERY, name: '查询用户', description: '查看用户列表与详情', sort: 10 },
  { module: '用户中心', code: PERMISSIONS.USER_CREATE, name: '创建用户', description: '后台创建用户', sort: 20 },
  { module: '用户中心', code: PERMISSIONS.USER_UPDATE, name: '更新用户', description: '编辑用户资料、启停账户', sort: 30 },
  { module: '用户中心', code: PERMISSIONS.USER_ASSIGN_ROLE, name: '分配角色', description: '给账户勾选角色组', sort: 40 },
  { module: '业务租户', code: PERMISSIONS.BUSINESS_QUERY, name: '查询业务', description: '查看业务列表、成员与开通情况', sort: 50 },
  { module: '业务租户', code: PERMISSIONS.BUSINESS_MANAGE, name: '管理业务', description: '新建/编辑业务、开通接口、调整成员', sort: 60 },
  { module: '接入端', code: PERMISSIONS.CLIENT_QUERY, name: '查询接入端', description: '查看 Web / 小程序接入端登记', sort: 70 },
  { module: '接入端', code: PERMISSIONS.CLIENT_MANAGE, name: '管理接入端', description: '维护 Web / 微信 / 支付宝接入端', sort: 80 },
  { module: '角色权限', code: PERMISSIONS.ROLE_QUERY, name: '查询角色', description: '查看平台级与业务身份角色', sort: 90 },
  { module: '角色权限', code: PERMISSIONS.ROLE_MANAGE, name: '管理角色', description: '新建/删除业务角色，配置平台级功能点', sort: 100 },
  {
    module: '功能点目录',
    code: PERMISSIONS.PERMISSION_QUERY,
    name: '查询功能点',
    description: '查看全局功能点目录',
    sort: 110,
    adminOnly: true,
  },
  {
    module: '功能点目录',
    code: PERMISSIONS.PERMISSION_MANAGE,
    name: '管理功能点',
    description: '新建/编辑/删除功能点',
    sort: 120,
    adminOnly: true,
  },
  {
    module: '功能点目录',
    code: PERMISSIONS.PERMISSION_IMPORT,
    name: '导入功能点',
    description: 'Excel 导入功能点与接口绑定',
    sort: 130,
    adminOnly: true,
  },
  {
    module: '功能点目录',
    code: PERMISSIONS.PERMISSION_EXPORT,
    name: '导出功能点',
    description: 'Excel 导出功能点、接口绑定与角色勾选',
    sort: 140,
    adminOnly: true,
  },
  { module: '微信小程序', code: PERMISSIONS.WECHAT_QUERY, name: '查询小程序', description: '查看已登记的微信小程序与订阅模板', sort: 150 },
  { module: '微信小程序', code: PERMISSIONS.WECHAT_MANAGE, name: '管理小程序', description: '登记/编辑/删除小程序与订阅消息', sort: 160 },
  { module: '微信小程序', code: PERMISSIONS.WECHAT_QRCODE, name: '生成小程序码', description: '按小程序生成场景码', sort: 170 },
];

/** 仅超管功能点编码（展示与分配时一律排除） */
export const ADMIN_ONLY_PERMISSION_CODES = new Set(
  platformMeta.filter((item) => item.adminOnly).map((item) => item.code),
);

/** 业务侧功能点：按能力聚合现有 GATEWAY business 路由（一功能点多接口） */
const businessFeatures: FeatureCatalogItem[] = [
  {
    scope: 'business',
    module: '认证',
    code: 'auth.account',
    name: '账号登录会话',
    description: '注册、账密登录、刷新、当前用户、改密、绑手机',
    sort: 10,
    apis: [
      'POST /auth/register',
      'POST /auth/login',
      'POST /auth/refresh',
      'GET /auth/me',
      'POST /auth/bind-phone',
      'POST /auth/change-password',
    ],
  },
  {
    scope: 'business',
    module: '认证',
    code: 'auth.oauth',
    name: '第三方登录',
    description: '微信 / 支付宝小程序登录',
    sort: 20,
    apis: ['POST /auth/wechat', 'POST /auth/alipay'],
  },
  {
    scope: 'business',
    module: '认证',
    code: 'auth.qrcode',
    name: '扫码登录',
    description: '二维码创建、扫码、确认与状态查询',
    sort: 30,
    apis: [
      'POST /auth/login/qrcode',
      'POST /auth/login/qrcode/scan',
      'POST /auth/login/qrcode/confirm',
      'GET /auth/login/qrcode/:ticket',
      'GET /auth/login/qrcode/:ticket/events',
    ],
  },
  {
    scope: 'business',
    module: '团队',
    code: 'team.query',
    name: '查询团队',
    description: '查看团队列表与详情',
    sort: 40,
    apis: ['GET /teams', 'GET /teams/:id'],
  },
  {
    scope: 'business',
    module: '团队',
    code: 'team.manage',
    name: '管理团队',
    description: '创建、加入、刷新邀请码、退出、调整成员',
    sort: 50,
    apis: [
      'POST /teams',
      'POST /teams/join',
      'POST /teams/:id/code',
      'POST /teams/:id/leave',
      'PATCH /teams/:id/members/:accountId',
    ],
  },
  {
    scope: 'business',
    module: '通用订单',
    code: 'order.query',
    name: '查询订单',
    description: '订单服务列表与详情',
    sort: 60,
    apis: ['GET /orders', 'GET /orders/:id'],
  },
  {
    scope: 'business',
    module: '通用订单',
    code: 'order.create',
    name: '创建订单',
    description: '创建订单',
    sort: 70,
    apis: ['POST /orders'],
  },
  {
    scope: 'business',
    module: '文档',
    code: 'docs.read',
    name: '阅读文档',
    description: '文档与分类的公开读取',
    sort: 80,
    apis: [
      'GET /docs/documents',
      'GET /docs/documents/:slug',
      'GET /docs/documents/id/:id',
      'GET /docs/categories',
      'GET /docs/categories/:slug',
    ],
  },
  {
    scope: 'business',
    module: '文档',
    code: 'docs.write',
    name: '编辑文档',
    description: '创建/更新/删除文档与调整目录树',
    sort: 90,
    apis: [
      'POST /docs/documents',
      'PUT /docs/documents/:id',
      'DELETE /docs/documents/:id',
      'POST /docs/documents/id/:id/children',
      'PUT /docs/documents/id/:id/parent',
    ],
  },
  {
    scope: 'business',
    module: '文档',
    code: 'docs.category.manage',
    name: '管理文档分类',
    description: '创建/更新/删除文档分类',
    sort: 100,
    apis: [
      'POST /docs/categories',
      'PUT /docs/categories/:id',
      'DELETE /docs/categories/:id',
    ],
  },
  {
    scope: 'business',
    module: '上传',
    code: 'upload.file',
    name: '文件上传',
    description: '同步/异步上传与对象删除',
    sort: 110,
    apis: ['POST /upload', 'POST /upload/async', 'DELETE /upload/objects'],
  },
  {
    scope: 'business',
    module: '上传',
    code: 'upload.job',
    name: '上传任务查询',
    description: '查询异步上传任务状态',
    sort: 120,
    apis: ['GET /upload/jobs/:id'],
  },
  {
    scope: 'business',
    module: '微信业务',
    code: 'wechat.phone',
    name: '微信手机号',
    description: '小程序手机号解密',
    sort: 130,
    apis: ['POST /wechat/phone'],
  },
  {
    scope: 'business',
    module: '微信业务',
    code: 'wechat.subscribe',
    name: '订阅消息模板',
    description: '拉取业务侧订阅消息模板清单',
    sort: 140,
    apis: ['GET /wechat/subscribe-templates'],
  },
  {
    scope: 'business',
    module: '回收·基础',
    code: 'recycle.session',
    name: '回收会话与策略',
    description: '当前回收身份与状态机策略',
    sort: 150,
    apis: ['GET /recycle/me', 'GET /recycle/policy/transitions'],
  },
  {
    scope: 'business',
    module: '回收·目录',
    code: 'recycle.catalog.read',
    name: '查询耗材目录',
    description: '类型 / 品牌 / 型号只读查询',
    sort: 160,
    apis: [
      'GET /recycle/cartridges',
      'GET /recycle/cartridges/types',
      'GET /recycle/cartridges/brands',
      'GET /recycle/cartridges/models',
    ],
  },
  {
    scope: 'business',
    module: '回收·目录',
    code: 'recycle.catalog.manage',
    name: '管理耗材目录',
    description: '维护类型 / 品牌 / 型号',
    sort: 170,
    apis: [
      'POST /recycle/cartridges/types',
      'PATCH /recycle/cartridges/types/:id',
      'DELETE /recycle/cartridges/types/:id',
      'POST /recycle/cartridges/brands',
      'PATCH /recycle/cartridges/brands/:id',
      'DELETE /recycle/cartridges/brands/:id',
      'POST /recycle/cartridges/models',
      'PATCH /recycle/cartridges/models/:id',
      'DELETE /recycle/cartridges/models/:id',
    ],
  },
  {
    scope: 'business',
    module: '回收·门店',
    code: 'recycle.store.read',
    name: '查询门店',
    description: '门店列表、附近、详情',
    sort: 180,
    apis: [
      'GET /recycle/stores',
      'GET /recycle/stores/nearby',
      'GET /recycle/stores/:id',
    ],
  },
  {
    scope: 'business',
    module: '回收·门店',
    code: 'recycle.store.manage',
    name: '管理门店',
    description: '创建/编辑/删除门店、员工绑定与门店码',
    sort: 190,
    apis: [
      'POST /recycle/stores',
      'GET /recycle/stores/mine',
      'POST /recycle/stores/bind',
      'GET /recycle/stores/:id/staff',
      'PATCH /recycle/stores/:id/staff/:accountId',
      'DELETE /recycle/stores/:id/staff/:accountId',
      'POST /recycle/stores/:id/qrcode',
      'PATCH /recycle/stores/:id',
      'DELETE /recycle/stores/:id',
    ],
  },
  {
    scope: 'business',
    module: '回收·订单',
    code: 'recycle.order.customer',
    name: '客户订单',
    description: '客户下单、我的订单、时间线、审计、动作与确认收款',
    sort: 200,
    apis: [
      'POST /recycle/orders',
      'GET /recycle/orders/mine',
      'GET /recycle/orders/mine/:id',
      'GET /recycle/orders/mine/:id/timeline',
      'GET /recycle/orders/mine/:id/audit',
      'POST /recycle/orders/mine/:id/actions/:action',
      'GET /recycle/orders/:id/merchant-transfer',
    ],
  },
  {
    scope: 'business',
    module: '回收·订单',
    code: 'recycle.order.staff',
    name: '业务员订单',
    description: '门店侧订单列表、详情、时间线、审计与动作',
    sort: 210,
    apis: [
      'GET /recycle/orders/staff',
      'GET /recycle/orders/staff/:id',
      'GET /recycle/orders/staff/:id/timeline',
      'GET /recycle/orders/staff/:id/audit',
      'POST /recycle/orders/staff/:id/actions/:action',
    ],
  },
  {
    scope: 'business',
    module: '回收·订单',
    code: 'recycle.order.manage',
    name: '订单总览与处置',
    description: '全量订单查询与通用动作/时间线/审计',
    sort: 220,
    apis: [
      'GET /recycle/orders',
      'GET /recycle/orders/:id',
      'POST /recycle/orders/:id/actions/:action',
      'GET /recycle/orders/:id/timeline',
      'GET /recycle/orders/:id/audit',
    ],
  },
  {
    scope: 'business',
    module: '回收·审批',
    code: 'recycle.approval',
    name: '审批流',
    description: '审批单查询、决定、取消与记录',
    sort: 230,
    apis: [
      'GET /recycle/approvals',
      'GET /recycle/approvals/:id',
      'POST /recycle/approvals/:id/decide',
      'POST /recycle/approvals/:id/cancel',
      'GET /recycle/approvals/:id/records',
    ],
  },
  {
    scope: 'business',
    module: '智能助手',
    code: 'agents.chat',
    name: '对话助手',
    description: '聊天状态与对话',
    sort: 240,
    apis: ['GET /agents/chat/status', 'POST /agents/chat'],
  },
  {
    scope: 'business',
    module: '智能助手',
    code: 'agents.vision',
    name: '视觉解析',
    description: '图片识别解析',
    sort: 250,
    apis: ['POST /agents/vision'],
  },
];

/** 从网关路由反查：平台功能编码 → 接口键列表 */
export function platformApisByPermissionCode(): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const route of GATEWAY_ROUTES) {
    if (route.scope !== 'platform' || !route.permissions?.length) {
      continue;
    }
    const key = routeKey(route);
    for (const code of route.permissions) {
      const list = map.get(code) ?? [];
      if (!list.includes(key)) {
        list.push(key);
      }
      map.set(code, list);
    }
  }
  return map;
}

function buildPlatformFeatures(): FeatureCatalogItem[] {
  const apisMap = platformApisByPermissionCode();
  return platformMeta.map((item) => ({
    ...item,
    scope: 'platform' as const,
    apis: apisMap.get(item.code) ?? [],
    adminOnly: item.adminOnly === true,
  }));
}

/** 种子与 Excel 模版用的默认功能点目录（平台 + 业务） */
export const DEFAULT_FEATURE_CATALOG: FeatureCatalogItem[] = [
  ...buildPlatformFeatures(),
  ...businessFeatures,
];

export const FEATURE_MODULE_ORDER = [
  '用户中心',
  '业务租户',
  '接入端',
  '角色权限',
  '功能点目录',
  '微信小程序',
  '认证',
  '团队',
  '通用订单',
  '文档',
  '上传',
  '微信业务',
  '回收·基础',
  '回收·目录',
  '回收·门店',
  '回收·订单',
  '回收·审批',
  '智能助手',
] as const;

export function parseApiKey(key: string): { method: GatewayHttpMethod; path: string } | null {
  const trimmed = key.trim().replace(/\s+/g, ' ');
  const space = trimmed.indexOf(' ');
  if (space <= 0) {
    return null;
  }
  const method = trimmed.slice(0, space).toUpperCase() as GatewayHttpMethod;
  const path = trimmed.slice(space + 1).trim();
  if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method) || !path.startsWith('/')) {
    return null;
  }
  return { method, path };
}

export function formatApiKey(method: string, path: string): string {
  return `${method.toUpperCase().trim()} ${path.trim()}`;
}

/** 校验业务功能点是否覆盖全部 business 路由（开发/单测用） */
export function uncoveredBusinessApiKeys(
  catalog: FeatureCatalogItem[] = DEFAULT_FEATURE_CATALOG,
): string[] {
  const covered = new Set(
    catalog.filter((item) => item.scope === 'business').flatMap((item) => item.apis),
  );
  return GATEWAY_ROUTES.filter((route) => route.scope === 'business')
    .map(routeKey)
    .filter((key) => !covered.has(key));
}
