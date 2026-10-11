import { optionalString, requiredString, rpcFail } from '@app/common';

const KEY_RE = /^[a-z][a-z0-9_]{0,15}$/;

export function parseTypeKey(value: unknown): string {
  const key = requiredString(value, 'key').toLowerCase();
  if (!KEY_RE.test(key)) {
    rpcFail(400, 'key 须为 1–16 位小写字母/数字/下划线，且以字母开头');
  }
  return key;
}

export function parseNonNegInt(value: unknown, field: string): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) {
    rpcFail(400, `${field} 须为非负整数`);
  }
  return n;
}

export function optionalNonNegInt(
  value: unknown,
  field: string,
): number | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  return parseNonNegInt(value, field);
}

export function optionalBool(value: unknown): boolean | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  if (value === 'true' || value === '1') {
    return true;
  }
  if (value === 'false' || value === '0') {
    return false;
  }
  rpcFail(400, '布尔字段非法');
}

export function optionalTrim(value: unknown, max: number, field: string): string | undefined {
  const raw = optionalString(value);
  if (raw === undefined) {
    return undefined;
  }
  if (raw.length > max) {
    rpcFail(400, `${field} 过长`);
  }
  return raw;
}

export function requiredTrim(value: unknown, max: number, field: string): string {
  const raw = requiredString(value, field);
  if (raw.length > max) {
    rpcFail(400, `${field} 过长`);
  }
  return raw;
}
