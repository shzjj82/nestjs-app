import { rpcFail } from '@app/common';
import type { Actor } from './actor';
import { isStaffRole, RECYCLE_ROLES, recycleIdentities } from './roles';

/** 未挂回收角色，或只挂了客户（没有业务员 / 超管） */
export function isCustomerOnly(actor: Actor): boolean {
  if (isStaffRole(actor.roles)) {
    return false;
  }
  return recycleIdentities(actor.roles).every(
    (role) => role === RECYCLE_ROLES.CUSTOMER,
  );
}

/** 目录 / 门店 / 业务员订单：客户不行，业务员及超管可以 */
export function requireStaff(actor: Actor, action = '维护目录或门店'): void {
  if (isCustomerOnly(actor)) {
    rpcFail(403, `当前身份不能${action}`);
  }
}
