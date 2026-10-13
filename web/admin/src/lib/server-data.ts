import { cache } from 'react';

import type { CenterUser } from '@/lib/accounts';
import { gatewayFetch } from '@/lib/auth';
import {
  type Business,
  type BusinessRole,
  type Permission,
  PLATFORM_ROLE_SCOPE,
  hasApi,
} from '@/lib/businesses';
import type { RoleOption } from '@/components/user-account-card';
import type { RegisteredWechatApp } from '@/lib/wechat-apps';

/** 同一请求内去重，layout / 多页面并行取数时不会打多次网关 */
export const getBusinesses = cache(() => gatewayFetch<Business[]>('/businesses'));

export const getPermissions = cache((scope?: 'platform' | 'business') =>
  gatewayFetch<Permission[]>(
    scope ? `/permissions?scope=${encodeURIComponent(scope)}` : '/permissions',
  ),
);

export const getRoles = cache((businessId?: string) =>
  gatewayFetch<BusinessRole[]>(
    businessId ? `/roles?businessId=${encodeURIComponent(businessId)}` : '/roles',
  ),
);

export const getWechatMiniprograms = cache(() =>
  gatewayFetch<RegisteredWechatApp[]>('/wechat/miniprograms'),
);

export interface UsersPageResult {
  items: CenterUser[];
  total: number;
  page: number;
  pageSize: number;
}

export const getUsersPage = cache((page = 1, pageSize = 20) =>
  gatewayFetch<UsersPageResult>(`/users?page=${page}&pageSize=${pageSize}`),
);

export async function getRoleOptions(): Promise<RoleOption[]> {
  const [roleList, businesses] = await Promise.all([getRoles(), getBusinesses()]);
  const names = new Map(businesses.map((b) => [b.id, b.name]));
  return roleList.map((role) => ({
    id: role.id,
    code: role.code,
    name: role.name,
    businessLabel: role.businessId
      ? (names.get(role.businessId) ?? role.businessId)
      : PLATFORM_ROLE_SCOPE,
  }));
}

export async function getDocsSpaceBusinesses(): Promise<Business[]> {
  const list = await getBusinesses();
  return list.filter((b) => b.status === 1 && hasApi(b, 'GET /docs/documents'));
}

export async function getDocsDocuments(
  bizCode: string,
  page = 1,
  pageSize = 20,
): Promise<{
  items: Array<{
    id: string;
    title: string;
    slug: string;
    visibility?: string;
    kind?: string;
    updatedAt?: string;
  }>;
  total: number;
  page: number;
  pageSize: number;
}> {
  const qs = new URLSearchParams({
    scope: 'all',
    page: String(page),
    pageSize: String(pageSize),
  });
  const result = await gatewayFetch<
    | {
        posts?: Array<{
          id: string;
          title: string;
          slug: string;
          visibility?: string;
          kind?: string;
          updatedAt?: string;
        }>;
        items?: Array<{
          id: string;
          title: string;
          slug: string;
          visibility?: string;
          kind?: string;
          updatedAt?: string;
        }>;
        total?: number;
        page?: number;
        pageSize?: number;
      }
    | Array<{
        id: string;
        title: string;
        slug: string;
        visibility?: string;
        kind?: string;
        updatedAt?: string;
      }>
  >(`/docs/documents?${qs}`, {
    headers: { 'X-Biz-Code': bizCode },
  });

  if (Array.isArray(result)) {
    return { items: result, total: result.length, page: 1, pageSize: result.length || pageSize };
  }
  const items = result.posts ?? result.items ?? [];
  return {
    items,
    total: result.total ?? items.length,
    page: result.page ?? page,
    pageSize: result.pageSize ?? pageSize,
  };
}

export async function getDocsCategories(
  bizCode: string,
): Promise<Array<{ id: string; slug: string; name: string }>> {
  const cats = await gatewayFetch<
    { categories?: Array<{ id: string; slug: string; name: string }> } | Array<{ id: string; slug: string; name: string }>
  >('/docs/categories', {
    headers: { 'X-Biz-Code': bizCode },
  });
  return Array.isArray(cats) ? cats : (cats.categories ?? []);
}
