/**
 * 回收业务的角色。
 *
 * 这些角色应建在「回收业务」下（role.businessId = 回收业务ID），
 * 不要建成平台级角色（businessId 为空），否则会在所有业务中生效。
 *
 * 对外「成员身份」只分三档：客户 / 业务员 / 超管。
 * agent / inspector / approver / finance 在流程动作上仍可区分，
 * 但对用户展示与列表数据范围一律视为「业务员」。
 */
export const RECYCLE_ROLES = {
  /** C 端客户：下单、提交、接受/拒绝报价、发起协商 */
  CUSTOMER: 'customer',
  /** 业务员（收货、退货等；对外与 inspector/approver/finance 同属业务员） */
  AGENT: 'agent',
  /** 验收动作（流程用）；对外身份 = 业务员 */
  INSPECTOR: 'inspector',
  /** 审批动作（流程用）；对外身份 = 业务员 */
  APPROVER: 'approver',
  /** 打款动作（流程用）；对外身份 = 业务员 */
  FINANCE: 'finance',
  /** 超管 */
  ADMIN: 'admin',
} as const;

export type RecycleRole = (typeof RECYCLE_ROLES)[keyof typeof RECYCLE_ROLES];

export const RECYCLE_ROLE_VALUES: string[] = Object.values(RECYCLE_ROLES);

/** 对外展示的成员身份（比角色粗） */
export const RECYCLE_IDENTITY = {
  CUSTOMER: 'customer',
  /** 业务员：覆盖 agent / inspector / approver / finance */
  STAFF: 'staff',
  ADMIN: 'admin',
} as const;

export type RecycleIdentity =
  (typeof RECYCLE_IDENTITY)[keyof typeof RECYCLE_IDENTITY];

/** 一律算作「业务员」的底层角色 */
export const RECYCLE_STAFF_ROLES: string[] = [
  RECYCLE_ROLES.AGENT,
  RECYCLE_ROLES.INSPECTOR,
  RECYCLE_ROLES.APPROVER,
  RECYCLE_ROLES.FINANCE,
];

/**
 * 业务内底层角色列表。没挂回收角色的登录用户默认是客户（C 端）。
 * 网关不按功能点挡人；谁能看单、谁能收货由这些身份决定。
 */
export function recycleIdentities(roles: string[]): string[] {
  const assigned = roles.filter((role) => RECYCLE_ROLE_VALUES.includes(role));
  return assigned.length ? assigned : [RECYCLE_ROLES.CUSTOMER];
}

/**
 * 对外成员身份：客户 / 业务员 / 超管（去重）。
 * 同时挂「验收员+客户」时会返回 customer + staff 两条，供前端切换入口。
 */
export function recycleMemberIdentities(roles: string[]): RecycleIdentity[] {
  const assigned = roles.filter((role) => RECYCLE_ROLE_VALUES.includes(role));
  if (!assigned.length) {
    return [RECYCLE_IDENTITY.CUSTOMER];
  }
  const out: RecycleIdentity[] = [];
  if (assigned.includes(RECYCLE_ROLES.CUSTOMER)) {
    out.push(RECYCLE_IDENTITY.CUSTOMER);
  }
  if (assigned.some((role) => RECYCLE_STAFF_ROLES.includes(role))) {
    out.push(RECYCLE_IDENTITY.STAFF);
  }
  if (assigned.includes(RECYCLE_ROLES.ADMIN)) {
    out.push(RECYCLE_IDENTITY.ADMIN);
  }
  return out.length ? out : [RECYCLE_IDENTITY.CUSTOMER];
}

export function isStaffRole(roles: string[]): boolean {
  return roles.some(
    (role) =>
      RECYCLE_STAFF_ROLES.includes(role) || role === RECYCLE_ROLES.ADMIN,
  );
}

export const RECYCLE_ROLE_LABELS: Record<string, string> = {
  [RECYCLE_ROLES.CUSTOMER]: '客户',
  [RECYCLE_ROLES.AGENT]: '业务员',
  [RECYCLE_ROLES.INSPECTOR]: '业务员',
  [RECYCLE_ROLES.APPROVER]: '业务员',
  [RECYCLE_ROLES.FINANCE]: '业务员',
  [RECYCLE_ROLES.ADMIN]: '超管',
};

export const RECYCLE_IDENTITY_LABELS: Record<string, string> = {
  [RECYCLE_IDENTITY.CUSTOMER]: '客户',
  [RECYCLE_IDENTITY.STAFF]: '业务员',
  [RECYCLE_IDENTITY.ADMIN]: '超管',
};
