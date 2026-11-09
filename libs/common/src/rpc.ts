import { RpcException } from '@nestjs/microservices';
import { z, type ZodTypeAny } from 'zod';

export function rpcFail(status: number, message: string): never {
  throw new RpcException({ status, message });
}

/** 把 Zod 错误转成统一的 RPC 400；可覆盖默认文案 */
export function parseWith<T extends ZodTypeAny>(
  schema: T,
  value: unknown,
  message?: string,
): z.infer<T> {
  const result = schema.safeParse(value);
  if (!result.success) {
    rpcFail(400, message ?? result.error.issues[0]?.message ?? '参数无效');
  }
  return result.data;
}

const trimmedNonEmpty = (label: string) =>
  z
    .string({ required_error: `${label} 必填`, invalid_type_error: `${label} 必填` })
    .trim()
    .min(1, `${label} 必填`);

export function requiredString(value: unknown, label: string): string {
  return parseWith(trimmedNonEmpty(label), value);
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

const pageSchema = z
  .object({
    page: z.unknown(),
    pageSize: z.unknown(),
  })
  .transform(({ page, pageSize }) => {
    const current = Math.max(1, Number(page) || 1);
    const size = Math.min(100, Math.max(1, Number(pageSize) || 20));
    return { page: current, pageSize: size, skip: (current - 1) * size };
  });

export function toPage(page?: unknown, pageSize?: unknown) {
  return pageSchema.parse({ page, pageSize });
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
