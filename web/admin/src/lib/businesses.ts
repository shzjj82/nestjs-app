export interface Business {
  id: string;
  code: string;
  name: string;
  description: string | null;
  status: number;
  /** 已开通的业务接口，如 `POST /auth/register` */
  apis: string[];
  defaultRoleId: string | null;
  isSystem: boolean;
  permissionIds: string[];
  memberCount: number;
  createdAt: string;
}

export interface BizApiItem {
  key: string;
  name: string;
  description: string | null;
  method: string;
  path: string;
}

export interface BizServiceCatalogItem {
  service: string;
  label: string;
  /** 服务未应答时为 false，接口名称退化为 `METHOD path` */
  online: boolean;
  apis: BizApiItem[];
}

/** 将 /biz-modules 目录压成 key → 接口项，便于详情展示名称 */
export function flattenApiCatalog(catalog: BizServiceCatalogItem[]): Map<string, BizApiItem> {
  const map = new Map<string, BizApiItem>();
  for (const service of catalog) {
    for (const api of service.apis) {
      map.set(api.key, api);
    }
  }
  return map;
}

/** platform 业务在网关层全部放行，其余业务按开通的接口判断 */
export function hasApi(business: Business, key: string): boolean {
  return business.code === 'platform' || business.apis.includes(key);
}

export interface BusinessRole {
  id: string;
  businessId: string | null;
  code: string;
  name: string;
  description: string | null;
  permissionIds: string[];
  permissionCodes: string[];
}

export interface Permission {
  id: string;
  scope?: 'platform' | 'business';
  code: string;
  name: string;
  module: string;
  description?: string | null;
  sort?: number;
  /** 绑定的网关接口键，如 `GET /users` */
  apis?: string[];
  /** 仅超级管理员；接口默认不返回，前端再兜底过滤 */
  adminOnly?: boolean;
}

/** 对外文案：避免「平台/业务」歧义 */
export function featureScopeLabel(scope?: 'platform' | 'business' | null): string {
  return scope === 'business' ? '开通模块' : '角色权限';
}

const MODULE_ORDER = [
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
];

export function groupPermissions(items: Permission[]): [string, Permission[]][] {
  const grouped = items.reduce<Record<string, Permission[]>>((acc, item) => {
    (acc[item.module] ||= []).push(item);
    return acc;
  }, {});
  for (const list of Object.values(grouped)) {
    list.sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || a.code.localeCompare(b.code));
  }
  return Object.entries(grouped).sort(([a], [b]) => {
    const ai = MODULE_ORDER.indexOf(a);
    const bi = MODULE_ORDER.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}

/** 平台级角色（不属于任何业务）显示用的范围名 */
export const PLATFORM_ROLE_SCOPE = '平台级';
