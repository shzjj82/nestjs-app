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
  code: string;
  name: string;
  module: string;
}

export function groupPermissions(items: Permission[]): [string, Permission[]][] {
  const grouped = items.reduce<Record<string, Permission[]>>((acc, item) => {
    (acc[item.module] ||= []).push(item);
    return acc;
  }, {});
  return Object.entries(grouped);
}

/** 平台级角色（不属于任何业务）显示用的范围名 */
export const PLATFORM_ROLE_SCOPE = '平台级';
