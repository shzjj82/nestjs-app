import { rpcFail } from '@app/common';
import type { Actor } from './actor';
import { recycleIdentities, RECYCLE_ROLES } from './roles';

/** 未挂回收角色，或只挂了客户 */
export function isCustomerOnly(actor: Actor): boolean {
  return recycleIdentities(actor.roles).every(
    (role) => role === RECYCLE_ROLES.CUSTOMER,
  );
}

/** 目录 / 门店维护：客户不行，业务员及以后的身份可以 */
export function requireStaff(actor: Actor, action = '维护目录或门店'): void {
  if (isCustomerOnly(actor)) {
    rpcFail(403, `当前身份不能${action}`);
  }
}
