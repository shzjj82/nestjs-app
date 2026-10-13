import { optionalString, rpcFail } from '@app/common';
import {
  Actor,
  ApprovalDecision,
  ApprovalType,
  AuditItemInput,
  hasAnyRole,
  OrderSnapshot,
  OrderStatus,
  readCents,
} from '../domain';
import { RECYCLE_ROLES, RECYCLE_STAFF_ROLES } from '../domain/roles';

/**
 * 订单动作。
 *
 * 设计原则：一个动作 = 一条明确的状态转移，绝不通开「直接改 status」的接口。
 * 同一个语义在不同身份下必须是两个动作（如 reject_inspect / reject_offer），
 * 否则权限就退化成「谁能改订单」，无法再细分。
 */
export type OrderAction =
  | 'quote'
  | 'submit'
  | 'receive'
  | 'evaluate'
  | 'reject_inspect'
  | 'negotiate'
  | 'accept'
  | 'reject_offer'
  | 'transfer'
  | 'sync_transfer'
  | 'return'
  | 'decide';

export const ORDER_ACTIONS: OrderAction[] = [
  'quote',
  'submit',
  'receive',
  'evaluate',
  'reject_inspect',
  'negotiate',
  'accept',
  'reject_offer',
  'transfer',
  'sync_transfer',
  'return',
];

export interface ActionContext {
  /** HTTP 调用来自会话；内部事件由发起方携带审批员身份 */
  actor: Actor | null;
  order: OrderSnapshot;
  payload: Record<string, unknown>;
}

export interface Transition {
  /** 允许的起始状态 */
  from: OrderStatus[];
  /** 目标状态；决策类动作按载荷解析 */
  to: OrderStatus | ((ctx: ActionContext) => OrderStatus);
  /** 允许的角色 */
  roles: string[];
  /** 仅允许服务内部调用（HTTP 侧不可达） */
  internalOnly?: boolean;
  /** 是否允许超管绕过角色限制，默认允许；涉及资金的动作显式关闭 */
  allowAdmin?: boolean;
  /** 动作成功后需要发起的审批类型；返回 null 表示无需审批 */
  approval?: (ctx: ActionContext) => ApprovalType | null;
  /** 业务规则 */
  guard?: (ctx: ActionContext) => void;
}

function requireActor(ctx: ActionContext): Actor {
  if (!ctx.actor) {
    rpcFail(401, '需要登录会话');
  }
  return ctx.actor;
}

function requireText(
  payload: Record<string, unknown>,
  field: string,
  label: string,
): string {
  const value = optionalString(payload[field]);
  if (!value) {
    rpcFail(400, `${label}必填`);
  }
  return value;
}

function requireAuditItems(payload: Record<string, unknown>): AuditItemInput[] {
  const raw = payload.items;
  if (!Array.isArray(raw) || raw.length === 0) {
    rpcFail(400, '验收价与预估价不一致时，必须先完成验收项勾选');
  }
  return raw.map((item) => {
    const row = (item ?? {}) as Record<string, unknown>;
    return {
      name: requireText(row, 'name', '验收项名称'),
      pass: row.pass === true,
      note: optionalString(row.note),
    };
  });
}

function requireDecision(payload: Record<string, unknown>): ApprovalDecision {
  const raw = optionalString(payload.decision);
  if (
    !raw ||
    !Object.values(ApprovalDecision).includes(raw as ApprovalDecision)
  ) {
    rpcFail(400, 'decision 必须是 accept / reject / reprice');
  }
  return raw as ApprovalDecision;
}

/** 提交：物流单号必填 */
function guardSubmit(ctx: ActionContext): void {
  requireText(ctx.payload, 'logisticsNo', '物流单号');
}

/** 评估报价：不得高于预估价；低于预估价必须逐项勾选验收项 */
function guardEvaluate(ctx: ActionContext): void {
  const price = readCents(ctx.payload, 'price');
  if (price > ctx.order.estimatePrice) {
    rpcFail(400, '评估报价不应高于预估回收价');
  }
  if (price < ctx.order.estimatePrice) {
    requireAuditItems(ctx.payload);
  }
}

/** 验收不通过：必须给出驳回原因 */
function guardRejectInspect(ctx: ActionContext): void {
  requireText(ctx.payload, 'note', '驳回原因');
}

/** 发起协商：协商价需落在「验收报价 < 协商价 < 预估价」区间内 */
function guardNegotiate(ctx: ActionContext): void {
  const price = readCents(ctx.payload, 'price');
  if (ctx.order.bOfferPrice === null) {
    rpcFail(409, '验收员尚未报价，无法发起协商');
  }
  if (price <= ctx.order.bOfferPrice) {
    rpcFail(400, '协商价需高于验收报价');
  }
  if (price >= ctx.order.estimatePrice) {
    rpcFail(400, '协商价需低于预估回收价');
  }
}

/** 同意报价：必须先有验收报价 */
function guardAccept(ctx: ActionContext): void {
  if (ctx.order.bOfferPrice === null) {
    rpcFail(409, '验收员尚未报价');
  }
}

/**
 * 客户发起收款：必须是订单本人，成交价已定。
 * 金额一律用 finalPrice，不采信客户端传的 amount。
 */
function guardTransfer(ctx: ActionContext): void {
  const actor = requireActor(ctx);
  if (actor.userId !== ctx.order.ownerId) {
    rpcFail(403, '仅订单本人可发起收款');
  }
  if (ctx.order.finalPrice === null || ctx.order.finalPrice <= 0) {
    rpcFail(409, '订单尚未确定成交价');
  }
}

/** 同步收款结果：仅订单本人（微信确认后回写）；业务员可补查 */
function guardSyncTransfer(ctx: ActionContext): void {
  const actor = requireActor(ctx);
  if (actor.userId === ctx.order.ownerId) {
    return;
  }
  if (hasAnyRole(actor, [...RECYCLE_STAFF_ROLES, RECYCLE_ROLES.ADMIN])) {
    return;
  }
  rpcFail(403, '仅订单本人或业务员可同步收款状态');
}

/** 退货：需回填退货物流单号 */
function guardReturn(ctx: ActionContext): void {
  requireText(ctx.payload, 'returnLogisticsNo', '退货物流单号');
}

/** 审批决策：reprice 必须给出新报价；accept 沿用协商价 */
function guardDecide(ctx: ActionContext): void {
  const decision = requireDecision(ctx.payload);
  if (decision === ApprovalDecision.REPRICE) {
    const price = readCents(ctx.payload, 'price');
    if (price > ctx.order.estimatePrice) {
      rpcFail(400, '重新定价不应高于预估回收价');
    }
  }
  if (
    decision === ApprovalDecision.ACCEPT &&
    ctx.order.negotiatePrice === null
  ) {
    rpcFail(409, '订单没有待处理的协商价');
  }
}

function decideTarget(ctx: ActionContext): OrderStatus {
  return requireDecision(ctx.payload) === ApprovalDecision.REJECT
    ? OrderStatus.REJECTED
    : OrderStatus.EVALUATED;
}

/**
 * 状态转移矩阵 —— 权限在服务端的核心载体。
 *
 * 一次授权 = 角色 ∩ 起始状态 ∩ 业务规则，三者缺一不可。
 */
export const TRANSITIONS: Record<OrderAction, Transition> = {
  quote: {
    from: [OrderStatus.DRAFT],
    to: OrderStatus.QUOTED,
    roles: [RECYCLE_ROLES.CUSTOMER],
    guard: (ctx) => {
      if (ctx.order.estimatePrice <= 0) {
        rpcFail(400, '订单没有预估报价，无法确认');
      }
    },
  },

  submit: {
    from: [OrderStatus.QUOTED],
    to: OrderStatus.SUBMITTED,
    roles: [RECYCLE_ROLES.CUSTOMER],
    guard: guardSubmit,
  },

  receive: {
    from: [OrderStatus.SUBMITTED],
    to: OrderStatus.INSPECTING,
    roles: RECYCLE_STAFF_ROLES,
    guard: (ctx) => {
      const actor = requireActor(ctx);
      // 业务员只能收自己名下（或尚未分配）的单；超管不受限
      if (
        !actor.roles.includes(RECYCLE_ROLES.ADMIN) &&
        ctx.order.assignedAgentId !== null &&
        ctx.order.assignedAgentId !== actor.userId
      ) {
        rpcFail(403, '该订单已分配给其他业务员');
      }
    },
  },

  evaluate: {
    from: [OrderStatus.INSPECTING],
    to: OrderStatus.EVALUATED,
    roles: RECYCLE_STAFF_ROLES,
    guard: guardEvaluate,
    approval: (ctx) =>
      Number(ctx.payload.price) < ctx.order.estimatePrice
        ? ApprovalType.PRICE_CHANGE
        : null,
  },

  reject_inspect: {
    from: [OrderStatus.INSPECTING],
    to: OrderStatus.REJECTED,
    roles: RECYCLE_STAFF_ROLES,
    guard: guardRejectInspect,
  },

  negotiate: {
    from: [OrderStatus.EVALUATED],
    to: OrderStatus.NEGOTIATING,
    roles: [RECYCLE_ROLES.CUSTOMER],
    guard: guardNegotiate,
    approval: () => ApprovalType.NEGOTIATION,
  },

  accept: {
    from: [OrderStatus.EVALUATED],
    to: OrderStatus.ACCEPTED,
    roles: [RECYCLE_ROLES.CUSTOMER],
    guard: guardAccept,
  },

  reject_offer: {
    from: [OrderStatus.EVALUATED],
    to: OrderStatus.REJECTED,
    roles: [RECYCLE_ROLES.CUSTOMER],
  },

  /**
   * 客户发起收款（非后台打款）：
   * 服务端向微信创建转账单 → 返回 package_info → 小程序 wx.requestMerchantTransfer。
   * paying 可重入：复用未完成的单或失败后重开。
   */
  transfer: {
    from: [OrderStatus.ACCEPTED, OrderStatus.PAYING],
    to: OrderStatus.PAYING,
    roles: [RECYCLE_ROLES.CUSTOMER],
    allowAdmin: false,
    guard: guardTransfer,
  },

  /** 查微信单并在 SUCCESS 时落 paid；客户确认收款后回写 */
  sync_transfer: {
    from: [OrderStatus.PAYING],
    to: OrderStatus.PAID,
    roles: [RECYCLE_ROLES.CUSTOMER, ...RECYCLE_STAFF_ROLES, RECYCLE_ROLES.ADMIN],
    allowAdmin: true,
    guard: guardSyncTransfer,
  },

  return: {
    from: [OrderStatus.REJECTED],
    to: OrderStatus.RETURNED,
    roles: RECYCLE_STAFF_ROLES,
    guard: guardReturn,
  },

  // 协商决策只能由审批流驱动，HTTP 侧不可达
  decide: {
    from: [OrderStatus.NEGOTIATING],
    to: decideTarget,
    roles: RECYCLE_STAFF_ROLES,
    internalOnly: true,
    allowAdmin: false,
    guard: guardDecide,
  },
};

export function isOrderAction(value: unknown): value is OrderAction {
  return typeof value === 'string' && value in TRANSITIONS;
}
