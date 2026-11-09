import { RpcException } from '@nestjs/microservices';

export function rpcFail(status: number, message: string): never {
  throw new RpcException({ status, message });
}

export function requiredString(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    rpcFail(400, `${label} 必填`);
  }
  return value.trim();
}

export function optionalString(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) {
    return undefined;
  }
  return value.trim();
}

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function toPage(page?: unknown, pageSize?: unknown) {
  const current = Math.max(1, Number(page) || 1);
  const size = Math.min(100, Math.max(1, Number(pageSize) || 20));
  return { page: current, pageSize: size, skip: (current - 1) * size };
}

/** 只从网关注入的 `_session` 取 userId；不含角色等业务身份 */
export function sessionUserId(payload: Record<string, unknown>): string | null {
  return optionalString(asRecord(payload._session).userId) ?? null;
}

export function requireSessionUserId(payload: Record<string, unknown>): string {
  const userId = sessionUserId(payload);
  if (!userId) {
    rpcFail(401, '需要登录会话');
  }
  return userId;
}
