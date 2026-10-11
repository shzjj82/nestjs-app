/**
 * 回收业务的角色。
 *
 * 这些角色应建在「回收业务」下（role.businessId = 回收业务ID），
 * 不要建成平台级角色（businessId 为空），否则会在所有业务中生效。
 * 角色与功能点的绑定沿用 usercenter 的 RBAC，回收服务只消费会话里的 roles/permissions。
 */
export const RECYCLE_ROLES = {
  /** C 端客户：下单、提交、接受/拒绝报价、发起协商 */
  CUSTOMER: 'customer',
  /** 业务员：收货、退货 */
  AGENT: 'agent',
  /** 验收员：评估报价、验收驳回 */
  INSPECTOR: 'inspector',
  /** 审批员：对协商与价格变更做决策 */
  APPROVER: 'approver',
  /** 财务：打款 */
  FINANCE: 'finance',
  /** 超管 */
  ADMIN: 'admin',
} as const;

export type RecycleRole = (typeof RECYCLE_ROLES)[keyof typeof RECYCLE_ROLES];

export const RECYCLE_ROLE_VALUES: string[] = Object.values(RECYCLE_ROLES);

/**
 * 业务内身份。没挂回收角色的登录用户默认是客户（C 端）。
 * 网关不按功能点挡人；谁能看单、谁能收货由这些身份决定。
 */
export function recycleIdentities(roles: string[]): string[] {
  const assigned = roles.filter((role) => RECYCLE_ROLE_VALUES.includes(role));
  return assigned.length ? assigned : [RECYCLE_ROLES.CUSTOMER];
}

export const RECYCLE_ROLE_LABELS: Record<string, string> = {
  [RECYCLE_ROLES.CUSTOMER]: '客户',
  [RECYCLE_ROLES.AGENT]: '业务员',
  [RECYCLE_ROLES.INSPECTOR]: '验收员',
  [RECYCLE_ROLES.APPROVER]: '审批员',
  [RECYCLE_ROLES.FINANCE]: '财务',
  [RECYCLE_ROLES.ADMIN]: '超管',
};
