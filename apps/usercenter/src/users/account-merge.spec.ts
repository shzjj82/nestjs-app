import { normalizePhone, pickSurvivor, tryNormalizePhone } from './account-merge';
import type { UserEntity } from '../entities';

function user(partial: Partial<UserEntity>): UserEntity {
  return {
    id: 'id',
    username: null,
    phone: null,
    email: null,
    passwordHash: null,
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
  it('prefers the password account over a wechat-only user', () => {
    const passwordUser = user({
      id: 'pwd',
      username: 'shzjj8882',
      passwordHash: 'hash',
    });
    const wechatUser = user({
      id: 'wx',
      nickname: '微信用户',
      createdAt: new Date('2026-01-02'),
    });
    expect(pickSurvivor(wechatUser, passwordUser).id).toBe('pwd');
    expect(pickSurvivor(passwordUser, wechatUser).id).toBe('pwd');
  });
});
