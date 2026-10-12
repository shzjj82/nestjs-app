import type { Actor } from '../../src/domain/actor';
import { requireStaff } from '../../src/domain/staff';

function actor(roles: string[]): Actor {
  return {
    userId: 'u-1',
    accountId: 'a-1',
    bizCode: 'recycle',
    roles,
    permissions: [],
    nickname: null,
    regionCode: null,
    openid: null,
    wechatAppId: null,
  };
}

function statusOf(fn: () => unknown): number {
  try {
    fn();
  } catch (err) {
    const error = (
      err as { getError?: () => { status?: number } }
    ).getError?.();
    return Number(error?.status);
  }
  throw new Error('预期抛错但没有抛');
}

describe('requireStaff', () => {
  it('rejects default customer', () => {
    expect(statusOf(() => requireStaff(actor([])))).toBe(403);
    expect(statusOf(() => requireStaff(actor(['customer'])))).toBe(403);
  });

  it('allows recycle staff identities', () => {
    expect(() => requireStaff(actor(['agent']))).not.toThrow();
    expect(() => requireStaff(actor(['admin']))).not.toThrow();
  });
});
