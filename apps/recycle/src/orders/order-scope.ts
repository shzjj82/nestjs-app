import { optionalString } from '@app/common';
import type { FindOptionsWhere } from 'typeorm';
import { Actor, isStaffRole, RECYCLE_ROLES, RECYCLE_STAFF_ROLES } from '../domain';
import type { RecycleOrderEntity } from '../entities';
import { isOrderAction, TRANSITIONS } from '../policy/transitions';

/** 行级数据范围判断需要的字段 */
type ScopedFields = Pick<
  RecycleOrderEntity,
  'bizCode' | 'ownerId' | 'assignedAgentId' | 'regionCode'
>;

export type OrderView = 'customer' | 'staff';

/** 路径 /mine、query view=customer|mine → 客户权限；/staff → 业务员权限 */
export function parseOrderView(value: unknown): OrderView | undefined {
  const raw = optionalString(value);
  if (raw === 'customer' || raw === 'mine') {
    return 'customer';
  }
  if (raw === 'staff' || raw === 'admin') {
    return 'staff';
  }
  return undefined;
}

/**
 * 按入口裁剪身份，避免「既是客户又是业务员」时按钮并集。
 * mine：只保留客户；staff：去掉客户，保留作业角色。
 */
export function actorForOrderView(actor: Actor, view: OrderView): Actor {
  if (view === 'customer') {
    return { ...actor, roles: [RECYCLE_ROLES.CUSTOMER] };
  }
  const roles = actor.roles.filter((role) => role !== RECYCLE_ROLES.CUSTOMER);
  return { ...actor, roles };
}

export interface OrderScope {
  /** 给 TypeORM 的 where（多组之间取 OR） */
  where: FindOptionsWhere<RecycleOrderEntity>[];
  /** 单条记录的归属判断，用于详情 / 动作前校验 */
  allows(order: ScopedFields): boolean;
}

/**
 * 客户视角：只看自己的单（个人中心）。
 * 不要求角色里显式挂 customer——只要登录即可查自己的 owner 单。
 */
export function customerScope(actor: Actor, bizCode: string): OrderScope {
  return {
    where: [{ bizCode, ownerId: actor.userId }],
    allows: (order) =>
      order.bizCode === bizCode && order.ownerId === actor.userId,
  };
}

/**
 * 业务员视角：业务内工作单。
 * agent / inspector / approver / finance / admin 对外都是业务员，数据范围不再细分。
 *
 * 注意 bizCode 必须由网关校验后的 `_bizCode` 传入，不能取 actor.bizCode：
 * 平台超管会话的 bizCode 是 platform，但接口访问的是 recycle 业务。
 */
export function staffScope(actor: Actor, bizCode: string): OrderScope {
  return {
    where: [{ bizCode }],
    allows: (order) => order.bizCode === bizCode,
  };
}

export function inferOrderView(
  actor: Actor,
  bizCode: string,
  order: ScopedFields,
): OrderView {
  const asOwner = customerScope(actor, bizCode).allows(order);
  if (isStaffRole(actor.roles) && !asOwner) {
    return 'staff';
  }
  return 'customer';
}

export function resolveOrderView(
  actor: Actor,
  bizCode: string,
  order: ScopedFields,
  requested: unknown,
): OrderView {
  return parseOrderView(requested) ?? inferOrderView(actor, bizCode, order);
}

/**
 * 执行动作时选视角。
 *
 * 显式 view（/mine|/staff）优先；未传时按动作角色推断——
 * 避免旧路径 `POST /orders/:id/actions/receive` 在「本人也是业务员」时
 * 被 infer 成 customer，裁掉业务员身份后 403。
 */
export function resolveOrderViewForAction(
  actor: Actor,
  bizCode: string,
  order: ScopedFields,
  action: string,
  requested: unknown,
): OrderView {
  const explicit = parseOrderView(requested);
  if (explicit) {
    return explicit;
  }
  if (isOrderAction(action)) {
    const roles = TRANSITIONS[action].roles;
    const staffOnly = roles.every(
      (role) =>
        RECYCLE_STAFF_ROLES.includes(role) || role === RECYCLE_ROLES.ADMIN,
    );
    const customerOnly =
      roles.length === 1 && roles[0] === RECYCLE_ROLES.CUSTOMER;
    if (staffOnly && isStaffRole(actor.roles)) {
      return 'staff';
    }
    if (customerOnly) {
      return 'customer';
    }
  }
  return inferOrderView(actor, bizCode, order);
}

export function canAccessOrder(
  actor: Actor,
  bizCode: string,
  order: ScopedFields,
  view: OrderView,
): boolean {
  if (view === 'customer') {
    return customerScope(actor, bizCode).allows(order);
  }
  return isStaffRole(actor.roles) && staffScope(actor, bizCode).allows(order);
}
