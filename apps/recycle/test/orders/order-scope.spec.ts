import type { Actor } from '../../src/domain';
import {
  actorForOrderView,
  inferOrderView,
  parseOrderView,
  resolveOrderView,
} from '../../src/orders/order-scope';

function actor(roles: string[], userId = 'u-1'): Actor {
  return {
    userId,
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

const own = {
  bizCode: 'recycle',
  ownerId: 'u-1',
  assignedAgentId: null,
  regionCode: null,
};

const other = { ...own, ownerId: 'u-2' };

describe('order view lens', () => {
  it('parses mine/staff path aliases', () => {
    expect(parseOrderView('mine')).toBe('customer');
    expect(parseOrderView('customer')).toBe('customer');
    expect(parseOrderView('staff')).toBe('staff');
    expect(parseOrderView('admin')).toBe('staff');
    expect(parseOrderView('nope')).toBeUndefined();
  });

  it('strips the other identity when applying a view', () => {
    const both = actor(['customer', 'agent']);
    expect(actorForOrderView(both, 'customer').roles).toEqual(['customer']);
    expect(actorForOrderView(both, 'staff').roles).toEqual(['agent']);
  });

  it('infers customer on own order even if also staff', () => {
    expect(inferOrderView(actor(['customer', 'agent']), 'recycle', own)).toBe(
      'customer',
    );
    expect(inferOrderView(actor(['agent']), 'recycle', other)).toBe('staff');
  });

  it('honors explicit staff view on own order', () => {
    expect(
      resolveOrderView(actor(['customer', 'agent']), 'recycle', own, 'staff'),
    ).toBe('staff');
  });
});
