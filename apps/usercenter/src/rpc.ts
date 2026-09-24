import { MQTT_GROUPS, sharePattern } from '@app/common';
import { RpcException } from '@nestjs/microservices';

export function ucPattern(pattern: string): string {
  return sharePattern(MQTT_GROUPS.USERCENTER, pattern);
}

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

export function systemCodeOf(
  payload: Record<string, unknown>,
  required = false,
): string | undefined {
  const code = optionalString(payload.systemCode) ?? optionalString(payload.appId);
  if (required && !code) {
    rpcFail(400, 'systemCode 必填');
  }
  return code;
}

export function clientCodeOf(
  payload: Record<string, unknown>,
  required?: false,
): string | undefined;
export function clientCodeOf(
  payload: Record<string, unknown>,
  required: true,
): string;
export function clientCodeOf(
  payload: Record<string, unknown>,
  required = false,
): string | undefined {
  const code =
    optionalString(payload.clientCode) ??
    optionalString(payload.appCode) ??
    optionalString(payload.appId);
  if (required && !code) {
    rpcFail(400, 'appCode 必填');
  }
  return code;
}

export function toPage(page?: unknown, pageSize?: unknown) {
  const current = Math.max(1, Number(page) || 1);
  const size = Math.min(100, Math.max(1, Number(pageSize) || 20));
  return { page: current, pageSize: size, skip: (current - 1) * size };
}
