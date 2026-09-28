import { cookies } from 'next/headers';
import { ACCESS_COOKIE, gatewayUrl, parseApiResponse } from './api';

export interface AdminUser {
  id: string;
  username: string | null;
  nickname: string;
  roles?: string[];
  permissions?: string[];
  wechatAppId?: string;
}

export function isAdmin(user: { roles?: string[] } | null | undefined): boolean {
  return !!user?.roles?.includes('admin');
}

export async function getAccessToken(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(ACCESS_COOKIE)?.value ?? null;
}

export async function gatewayFetch<T>(
  path: string,
  init: RequestInit = {},
  token?: string | null,
): Promise<T> {
  const headers = new Headers(init.headers);
  const access = token ?? (await getAccessToken());
  if (access) {
    headers.set('Authorization', `Bearer ${access}`);
  }
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const res = await fetch(`${gatewayUrl()}${path.startsWith('/') ? path : `/${path}`}`, {
    ...init,
    headers,
    cache: 'no-store',
  });
  return parseApiResponse<T>(res);
}

export async function fetchMe(token?: string | null): Promise<AdminUser | null> {
  try {
    return await gatewayFetch<AdminUser>('/auth/me', {}, token);
  } catch {
    return null;
  }
}

export const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  secure: process.env.NODE_ENV === 'production',
};
