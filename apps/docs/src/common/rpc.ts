import { MQTT_GROUPS, sharePattern } from '@app/common';
import { RpcException } from '@nestjs/microservices';

export function docsPattern(pattern: string): string {
  return sharePattern(MQTT_GROUPS.DOCS, pattern);
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

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
