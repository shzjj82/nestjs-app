import { Injectable } from '@nestjs/common';
import { rpcFail } from '@app/common';
import {
  Actor,
  ApprovalType,
  hasAnyRole,
  isAdmin,
  OrderSnapshot,
  OrderStatus,
} from '../domain';
import {
  ActionContext,
  isOrderAction,
  OrderAction,
  ORDER_ACTIONS,
  TRANSITIONS,
} from './transitions';

export interface AuthorizedAction {
  action: OrderAction;
  from: OrderStatus;
  to: OrderStatus;
  /** 动作完成后需要发起的审批；null 表示无需审批 */
  approval: ApprovalType | null;
}

export interface AuthorizeOptions {
  /** true 表示来自服务内部事件，允许执行 internalOnly 的动作 */
  internal?: boolean;
}

/**
 * 订单策略引擎。
 *
 * 这里不碰数据库、不认识 TypeORM 实体，输入只有「调用者 + 订单快照 + 载荷」，
 * 因此可以被订单上下文复用，也可以被单测直接驱动。
 */
@Injectable()
export class OrderPolicyService {
  /**
   * 校验一次动作授权。任一条件不满足即抛错，调用方无需再判。
   *
   * 顺序：动作存在 → 是否允许外部调用 → 角色 → 起始状态 → 业务规则
   */
  authorize(
    action: string,
    ctx: ActionContext,
    options: AuthorizeOptions = {},
  ): AuthorizedAction {
    if (!isOrderAction(action)) {
      rpcFail(400, `未知动作：${action}`);
    }
    const transition = TRANSITIONS[action];

    if (transition.internalOnly && options.internal !== true) {
      rpcFail(403, `动作 ${action} 仅允许服务内部调用`);
    }

    const actor = ctx.actor;
    if (!actor) {
      rpcFail(401, '需要登录会话');
    }

    const adminBypass = transition.allowAdmin !== false && isAdmin(actor);
    if (!adminBypass && !hasAnyRole(actor, transition.roles)) {
      rpcFail(403, `当前身份不允许执行 ${action}`);
    }

    if (!transition.from.includes(ctx.order.status)) {
      rpcFail(409, `订单当前为 ${ctx.order.status}，不支持 ${action}`);
    }

    transition.guard?.(ctx);

    const to =
      typeof transition.to === 'function' ? transition.to(ctx) : transition.to;
    const approval = transition.approval?.(ctx) ?? null;
    return { action, from: ctx.order.status, to, approval };
  }

  /** 当前调用者在该订单上可执行的动作（不含内部动作），用于接口回传 */
  availableActions(actor: Actor | null, order: OrderSnapshot): OrderAction[] {
    if (!actor) {
      return [];
    }
    return ORDER_ACTIONS.filter((action) => {
      const transition = TRANSITIONS[action];
      if (transition.internalOnly) {
        return false;
      }
      if (!transition.from.includes(order.status)) {
        return false;
      }
      const adminBypass = transition.allowAdmin !== false && isAdmin(actor);
      return adminBypass || hasAnyRole(actor, transition.roles);
    });
  }

  /** 状态机全量描述，供管理端渲染流程图 / 权限矩阵 */
  describe() {
    return ORDER_ACTIONS.concat(['decide'] as OrderAction[]).map((action) => {
      const transition = TRANSITIONS[action];
      return {
        action,
        from: transition.from,
        to: typeof transition.to === 'function' ? 'dynamic' : transition.to,
        roles: transition.roles,
        internalOnly: transition.internalOnly ?? false,
      };
    });
  }
}
