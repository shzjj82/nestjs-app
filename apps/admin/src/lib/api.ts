export const ACCESS_COOKIE = 'admin_access_token';
export const REFRESH_COOKIE = 'admin_refresh_token';

export function gatewayUrl(): string {
  return (
    process.env.GATEWAY_URL ??
    process.env.NEXT_PUBLIC_GATEWAY_URL ??
    'http://127.0.0.1:3000'
  );
}

export function expectedAppVersion(): string | null {
  return process.env.EXPECTED_APP_VERSION ?? process.env.NEXT_PUBLIC_EXPECTED_APP_VERSION ?? null;
}

export interface ApiResponse<T> {
  success: boolean;
  code: number;
  message: string;
  data: T | null;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function parseApiResponse<T>(res: Response): Promise<T> {
  const json = (await res.json()) as ApiResponse<T> & { message?: string };
  if (!res.ok || json.success === false) {
    throw new ApiError(
      json.code || res.status,
      json.message || `请求失败 (${res.status})`,
    );
  }
  return json.data as T;
}

/** 浏览器侧通过本站代理访问网关 */
export async function adminFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const res = await fetch(`/api/proxy${path.startsWith('/') ? path : `/${path}`}`, {
    ...init,
    headers,
  });
  return parseApiResponse<T>(res);
}
