export {
  BillDraftSchema,
  BillItemSchema,
  MoneyFenSchema,
  validateBillDraft,
  parseBillDraftStructure,
  finalizeOcrBillDraft,
  type BillDraft,
  type BillItem,
  type FinalizeOcrBillResult,
  type ValidateBillDraftResult,
  type ValidationIssue,
} from './schema';

export {
  auditBillBalance,
  reconcileOcrBillDraft,
  normalizePackingOrderDiscounts,
  stripShifuDerivedItemDiscounts,
  looksLikeShifuDerivedItemDiscounts,
  fixMisreadLineSubtotals,
  fixExtraFenScale,
  calibrateByStatedDiscount,
  fixAbsorbedLineSubtotalOnLineTotalChannels,
  finalizeOcrBillForApi,
  formatAuditForRepair,
  type BillAuditFixKind,
  type BillAuditHypothesis,
  type BillAuditReport,
} from './audit';

export {
  PROMPT_ORDER_TO_JSON,
  PROMPT_USER_TEMPLATE,
  PROMPT_REPAIR_BALANCE,
  buildUserPrompt,
  buildRepairPrompt,
  diagnoseBillBalance,
  type BillBalanceDiagnosis,
} from './prompt';

export { billDraftJsonSchema } from './json-schema';

export {
  BundlePickSchema,
  CreateShareBodySchema,
  ItemPriceSchema,
  SplitPayloadSchema,
  reorderWithBundle,
  type CreateShareBody,
  type ItemPriceDto,
  type SplitPayload,
} from './share';

export {
  allocateByWeight,
  splitBill,
  type ItemPrice,
  type SplitResult,
} from './split';
