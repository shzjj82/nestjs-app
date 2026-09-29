import type { UserEntity } from '../entities';
import { rpcFail } from '../rpc';

export function tryNormalizePhone(raw: string): string | null {
  let phone = raw.trim().replace(/[\s-]/g, '');
  if (phone.startsWith('+86')) {
    phone = phone.slice(3);
  } else if (phone.startsWith('86') && phone.length === 13) {
    phone = phone.slice(2);
  }
  return /^1\d{10}$/.test(phone) ? phone : null;
}

export function normalizePhone(raw: string): string {
  const phone = tryNormalizePhone(raw);
  if (!phone) {
    rpcFail(400, '手机号格式不正确，请使用 11 位大陆手机号');
  }
  return phone;
}

export interface MergeCandidate {
  user: UserEntity;
  hasPasswordAccount: boolean;
}

export function pickSurvivor(current: MergeCandidate, other: MergeCandidate): UserEntity {
  if (current.hasPasswordAccount !== other.hasPasswordAccount) {
    return current.hasPasswordAccount ? current.user : other.user;
  }
  return current.user.createdAt <= other.user.createdAt ? current.user : other.user;
}
