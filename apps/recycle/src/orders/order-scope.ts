import type { FindOptionsWhere } from 'typeorm';
import { Actor, isAdmin, isStaffRole } from '../domain';
import type { RecycleOrderEntity } from '../entities';

/** 行级数据范围判断需要的字段 */
type ScopedFields = Pick<
  RecycleOrderEntity,
  'bizCode' | 'ownerId' | 'assignedAgentId' | 'regionCode'
>;

export type OrderView = 'customer' | 'staff';

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

/** @deprecated 使用 customerScope / staffScope；保留给未改完的调用方 */
export function scopeFor(actor: Actor, bizCode: string): OrderScope {
  if (isAdmin(actor) || isStaffRole(actor.roles)) {
    return staffScope(actor, bizCode);
  }
  return customerScope(actor, bizCode);
}

/** 详情 / 动作：客户单或业务员单任一可见即可 */
export function canAccessOrder(
  actor: Actor,
  bizCode: string,
  order: ScopedFields,
): boolean {
  if (customerScope(actor, bizCode).allows(order)) {
    return true;
  }
  if (isStaffRole(actor.roles) && staffScope(actor, bizCode).allows(order)) {
    return true;
  }
  return false;
}
