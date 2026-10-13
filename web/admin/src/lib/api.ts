export const ACCESS_COOKIE = 'admin_access_token';
export const REFRESH_COOKIE = 'admin_refresh_token';
export const BIZ_HEADER = 'X-Biz-Code';

/** admin 控制台自身所属的业务；平台管理接口只接受该业务会话 */
export function adminBizCode(): string {
  return process.env.ADMIN_BIZ_CODE ?? 'platform';
}

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

/** 响应体为空或不是 JSON 时（如上游崩溃），也转成统一的失败信封，避免 res.json() 抛解析错误 */
export async function readApiResponse<T>(res: Response): Promise<ApiResponse<T>> {
  const text = await res.text();
  if (text) {
    try {
      return JSON.parse(text) as ApiResponse<T>;
    } catch {
      // 非 JSON，按失败处理
    }
  }
  return {
    success: false,
    code: res.status,
    message: text && text.length <= 200 ? text : `请求失败 (${res.status})`,
    data: null,
  };
}

/** 服务端路由连不上网关时返回的统一错误 */
export function gatewayUnavailableResponse(): Response {
  return Response.json(
    {
      success: false,
      code: 502,
      message: `无法连接网关 ${gatewayUrl()}，请确认后端服务已启动`,
      data: null,
    },
    { status: 502 },
  );
}

export async function parseApiResponse<T>(res: Response): Promise<T> {
  const json = await readApiResponse<T>(res);
  if (!res.ok || json.success === false) {
    throw new ApiError(
      json.code || res.status,
      json.message || `请求失败 (${res.status})`,
    );
  }
  return json.data as T;
}

/**
 * 浏览器侧通过本站代理访问网关。
 * bizCode：操作某个业务的数据（如文档、上传）时指定；不传则按平台业务请求。
 */
export async function adminFetch<T>(
  path: string,
  { bizCode, ...init }: RequestInit & { bizCode?: string } = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (bizCode) {
    headers.set(BIZ_HEADER, bizCode);
  }
  const res = await fetch(`/api/proxy${path.startsWith('/') ? path : `/${path}`}`, {
    ...init,
    headers,
  });
  return parseApiResponse<T>(res);
}
