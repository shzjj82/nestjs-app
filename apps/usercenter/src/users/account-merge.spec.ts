import { normalizePhone, pickSurvivor, tryNormalizePhone } from './account-merge';
import type { UserEntity } from '../entities';

function user(partial: Partial<UserEntity>): UserEntity {
  return {
    id: 'id',
    phone: null,
    email: null,
    nickname: '',
    avatar: null,
    status: 1,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...partial,
  };
}

describe('normalizePhone', () => {
  it('accepts 11-digit mainland numbers and strips +86 / 86', () => {
    expect(normalizePhone('13800138000')).toBe('13800138000');
    expect(normalizePhone('+86 138-0013-8000')).toBe('13800138000');
    expect(normalizePhone('8613800138000')).toBe('13800138000');
  });

  it('returns null from tryNormalizePhone for non-phone usernames', () => {
    expect(tryNormalizePhone('shzjj8882')).toBeNull();
    expect(tryNormalizePhone('12345')).toBeNull();
  });
});

describe('pickSurvivor', () => {
  it('prefers the user holding a password account over a wechat-only user', () => {
    const passwordUser = { user: user({ id: 'pwd' }), hasPasswordAccount: true };
    const wechatUser = {
      user: user({ id: 'wx', nickname: '微信用户', createdAt: new Date('2025-12-01') }),
      hasPasswordAccount: false,
    };
    expect(pickSurvivor(wechatUser, passwordUser).id).toBe('pwd');
    expect(pickSurvivor(passwordUser, wechatUser).id).toBe('pwd');
  });

  it('falls back to the older user when both are equal', () => {
    const older = { user: user({ id: 'old' }), hasPasswordAccount: false };
    const newer = {
      user: user({ id: 'new', createdAt: new Date('2026-02-01') }),
      hasPasswordAccount: false,
    };
    expect(pickSurvivor(newer, older).id).toBe('old');
  });
});
