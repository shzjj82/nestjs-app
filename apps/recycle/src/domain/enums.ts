/** 耗材类型：ink 墨盒（喷墨）/ toner 硒鼓（激光） */
export enum CartridgeType {
  INK = 'ink',
  TONER = 'toner',
}

export const CARTRIDGE_TYPES: CartridgeType[] = Object.values(CartridgeType);

/** 是否是合法的耗材类型（目录接口用它做严格校验，不静默兜底） */
export function isCartridgeType(value: unknown): value is CartridgeType {
  return value === CartridgeType.INK || value === CartridgeType.TONER;
}

/** 审核（验收）结论，对应数据库枚举 `recycle_audit_result` */
export enum AuditResult {
  APPROVED = 'approved',
  REJECTED = 'rejected',
  PRICE_CHANGE = 'price_change',
}

export const AUDIT_RESULT_ENUM_NAME = 'recycle_audit_result';
export const AUDIT_RESULTS: AuditResult[] = Object.values(AuditResult);

/** 审批任务类型，对应数据库枚举 `recycle_approval_type` */
export enum ApprovalType {
  /** 验收价与预估价不一致，需要审批 */
  PRICE_CHANGE = 'price_change',
  /** 客户发起协商定价，需要审批员决策 */
  NEGOTIATION = 'negotiation',
}

export const APPROVAL_TYPE_ENUM_NAME = 'recycle_approval_type';
export const APPROVAL_TYPES: ApprovalType[] = Object.values(ApprovalType);

/** 审批任务状态，对应数据库枚举 `recycle_approval_status` */
export enum ApprovalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
}

export const APPROVAL_STATUS_ENUM_NAME = 'recycle_approval_status';
export const APPROVAL_STATUSES: ApprovalStatus[] =
  Object.values(ApprovalStatus);

/** 审批员对协商的决策 */
export enum ApprovalDecision {
  ACCEPT = 'accept',
  REJECT = 'reject',
  REPRICE = 'reprice',
}

export const APPROVAL_DECISIONS: ApprovalDecision[] =
  Object.values(ApprovalDecision);
