import { Test } from '@nestjs/testing';
import { Actor, OrderSnapshot, OrderStatus } from '../../src/domain';
import { OrderPolicyService } from '../../src/policy/policy.service';

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

function order(overrides: Partial<OrderSnapshot> = {}): OrderSnapshot {
  return {
    id: 'o-1',
    bizCode: 'recycle',
    status: OrderStatus.DRAFT,
    ownerId: 'u-1',
    assignedAgentId: null,
    regionCode: null,
    estimatePrice: 3000,
    bOfferPrice: null,
    negotiatePrice: null,
    finalPrice: null,
    version: 0,
    ...overrides,
  };
}

/** 断言动作被拒绝，并返回错误里的 status */
function expectStatus(fn: () => unknown): number {
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

describe('OrderPolicyService', () => {
  let policy: OrderPolicyService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [OrderPolicyService],
    }).compile();
    policy = module.get(OrderPolicyService);
  });

  it('未挂回收角色的登录用户按客户身份估价', () => {
    const ok = policy.authorize('quote', {
      actor: actor([]),
      order: order({ status: OrderStatus.DRAFT }),
      payload: {},
    });
    expect(ok.to).toBe(OrderStatus.QUOTED);
  });

  it('角色不符：客户不能在验收中状态评估报价', () => {
    const status = expectStatus(() =>
      policy.authorize('evaluate', {
        actor: actor(['customer']),
        order: order({ status: OrderStatus.INSPECTING, estimatePrice: 3000 }),
        payload: { price: 3000 },
      }),
    );
    expect(status).toBe(403);
  });

  it('状态不符：客户不能在已评估状态重复提交', () => {
    const status = expectStatus(() =>
      policy.authorize('submit', {
        actor: actor(['customer']),
        order: order({ status: OrderStatus.EVALUATED }),
        payload: { logisticsNo: 'SF123' },
      }),
    );
    expect(status).toBe(409);
  });

  it('业务规则：报价高于预估价被拒', () => {
    const status = expectStatus(() =>
      policy.authorize('evaluate', {
        actor: actor(['inspector']),
        order: order({ status: OrderStatus.INSPECTING, estimatePrice: 3000 }),
        payload: { price: 3500 },
      }),
    );
    expect(status).toBe(400);
  });

  it('业务规则：低于预估价但未勾选验收项被拒', () => {
    const status = expectStatus(() =>
      policy.authorize('evaluate', {
        actor: actor(['inspector']),
        order: order({ status: OrderStatus.INSPECTING, estimatePrice: 3000 }),
        payload: { price: 2000 },
      }),
    );
    expect(status).toBe(400);
  });

  it('低于预估价且勾选验收项：通过并发起价格变更审批', () => {
    const result = policy.authorize('evaluate', {
      actor: actor(['inspector']),
      order: order({ status: OrderStatus.INSPECTING, estimatePrice: 3000 }),
      payload: { price: 2000, items: [{ name: '外壳完好', pass: true }] },
    });
    expect(result.to).toBe(OrderStatus.EVALUATED);
    expect(result.approval).toBe('price_change');
  });

  it('按预估价通过时不发起审批', () => {
    const result = policy.authorize('evaluate', {
      actor: actor(['inspector']),
      order: order({ status: OrderStatus.INSPECTING, estimatePrice: 3000 }),
      payload: { price: 3000 },
    });
    expect(result.approval).toBeNull();
  });

  it('协商价必须落在验收报价与预估价之间', () => {
    const below = expectStatus(() =>
      policy.authorize('negotiate', {
        actor: actor(['customer']),
        order: order({ status: OrderStatus.EVALUATED, bOfferPrice: 2000 }),
        payload: { price: 1500 },
      }),
    );
    const above = expectStatus(() =>
      policy.authorize('negotiate', {
        actor: actor(['customer']),
        order: order({ status: OrderStatus.EVALUATED, bOfferPrice: 2000 }),
        payload: { price: 3000 },
      }),
    );
    expect(below).toBe(400);
    expect(above).toBe(400);

    const ok = policy.authorize('negotiate', {
      actor: actor(['customer']),
      order: order({ status: OrderStatus.EVALUATED, bOfferPrice: 2000 }),
      payload: { price: 2500 },
    });
    expect(ok.to).toBe(OrderStatus.NEGOTIATING);
    expect(ok.approval).toBe('negotiation');
  });

  it('协商决策是内部动作，HTTP 侧不可达', () => {
    const status = expectStatus(() =>
      policy.authorize('decide', {
        actor: actor(['approver']),
        order: order({ status: OrderStatus.NEGOTIATING, negotiatePrice: 2500 }),
        payload: { decision: 'accept' },
      }),
    );
    expect(status).toBe(403);

    const ok = policy.authorize(
      'decide',
      {
        actor: actor(['approver']),
        order: order({ status: OrderStatus.NEGOTIATING, negotiatePrice: 2500 }),
        payload: { decision: 'accept' },
      },
      { internal: true },
    );
    expect(ok.to).toBe(OrderStatus.EVALUATED);
  });

  it('打款不允许超管绕过角色限制', () => {
    const status = expectStatus(() =>
      policy.authorize('transfer', {
        actor: actor(['admin']),
        order: order({ status: OrderStatus.ACCEPTED, finalPrice: 2000 }),
        payload: { amount: 2000 },
      }),
    );
    expect(status).toBe(403);
  });

  it('availableActions 按身份与状态返回可执行动作', () => {
    const customer = policy.availableActions(
      actor(['customer']),
      order({ status: OrderStatus.EVALUATED, bOfferPrice: 2000 }),
    );
    expect(customer).toEqual(['negotiate', 'accept', 'reject_offer']);

    const agent = policy.availableActions(
      actor(['agent']),
      order({ status: OrderStatus.EVALUATED }),
    );
    expect(agent).toEqual([]);
  });

  it('业务员不能收别人名下的单', () => {
    const status = expectStatus(() =>
      policy.authorize('receive', {
        actor: actor(['agent'], 'u-2'),
        order: order({ status: OrderStatus.SUBMITTED, assignedAgentId: 'u-1' }),
        payload: {},
      }),
    );
    expect(status).toBe(403);
  });
});
