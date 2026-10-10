import type { FindOptionsWhere } from 'typeorm';
import { IsNull } from 'typeorm';
import { Actor, hasAnyRole, isAdmin } from '../domain';
import { RECYCLE_ROLES } from '../domain/roles';
import type { RecycleOrderEntity } from '../entities';

/** 行级数据范围判断需要的字段 */
type ScopedFields = Pick<
  RecycleOrderEntity,
  'bizCode' | 'ownerId' | 'assignedAgentId' | 'regionCode'
>;

export interface OrderScope {
  /** 给 TypeORM 的 where（多组之间取 OR） */
  where: FindOptionsWhere<RecycleOrderEntity>[];
  /** 单条记录的归属判断，用于详情 / 动作前校验 */
  allows(order: ScopedFields): boolean;
}

/**
 * 解析调用者能看到哪些订单。
 *
 * 注意 bizCode 必须由网关校验后的 `_bizCode` 传入，不能取 actor.bizCode：
 * 平台超管会话的 bizCode 是 platform，但接口访问的是 recycle 业务。
 */
export function scopeFor(actor: Actor, bizCode: string): OrderScope {
  // 超管 / 财务 / 审批员：业务内全量
  if (
    isAdmin(actor) ||
    hasAnyRole(actor, [RECYCLE_ROLES.FINANCE, RECYCLE_ROLES.APPROVER])
  ) {
    return {
      where: [{ bizCode }],
      allows: (order) => order.bizCode === bizCode,
    };
  }

  // 验收员：有片区则按片区收窄
  if (hasAnyRole(actor, [RECYCLE_ROLES.INSPECTOR])) {
    const region = actor.regionCode;
    return {
      where: region ? [{ bizCode, regionCode: region }] : [{ bizCode }],
      allows: (order) =>
        order.bizCode === bizCode && (!region || order.regionCode === region),
    };
  }

  // 业务员：自己名下的 + 尚未分配的（可领取）
  if (hasAnyRole(actor, [RECYCLE_ROLES.AGENT])) {
    return {
      where: [
        { bizCode, assignedAgentId: actor.userId },
        { bizCode, assignedAgentId: IsNull() },
      ],
      allows: (order) =>
        order.bizCode === bizCode &&
        (order.assignedAgentId === null ||
          order.assignedAgentId === actor.userId),
    };
  }

  // 客户：只看自己的
  return {
    where: [{ bizCode, ownerId: actor.userId }],
    allows: (order) =>
      order.bizCode === bizCode && order.ownerId === actor.userId,
  };
}
