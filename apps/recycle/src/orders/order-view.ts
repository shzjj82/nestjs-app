import {
  Actor,
  CartridgeType,
  hasAnyRole,
  ORDER_STATUS_LABELS,
  OrderStatus,
} from '../domain';
import { RECYCLE_ROLES } from '../domain/roles';
import type { RecycleOrderEntity } from '../entities';
import type { OrderAction } from '../policy/transitions';

export interface OrderPaymentView {
  billNo: string | null;
  paidAt: string | null;
}

export interface OrderView {
  id: string;
  code: string;
  status: OrderStatus;
  statusLabel: string;
  brand: string;
  model: string;
  spec: string | null;
  cartridgeType: CartridgeType | null;
  totalQuantity: number;
  /** 金额单位统一为分 */
  estimatePrice: number;
  bOfferPrice: number | null;
  negotiatePrice: number | null;
  finalPrice: number | null;
  screenshots: string[];
  logistics: {
    no: string;
    company: string | null;
    returnNo: string | null;
  };
  /** 验收备注，客户可见 */
  bEvalNote: string | null;
  /** 内部备注，仅作业人员可见 */
  internalNote?: string | null;
  /** 打款信息，仅财务可见 */
  payment?: OrderPaymentView;
  /** 当前调用者在该订单上可执行的动作 */
  availableActions: OrderAction[];
  createdAt: string;
  updatedAt: string;
}

const STAFF_ROLES = [
  RECYCLE_ROLES.AGENT,
  RECYCLE_ROLES.INSPECTOR,
  RECYCLE_ROLES.APPROVER,
  RECYCLE_ROLES.FINANCE,
  RECYCLE_ROLES.ADMIN,
];

const FINANCE_ROLES = [RECYCLE_ROLES.FINANCE, RECYCLE_ROLES.ADMIN];

/**
 * 出口序列化：按角色裁剪字段。
 *
 * 字段级权限统一在这里处理，不在各接口里手写 delete，
 * 避免新增字段时漏掉某个接口的脱敏。
 */
export function toOrderView(
  order: RecycleOrderEntity,
  actor: Actor,
  availableActions: OrderAction[],
): OrderView {
  const isStaff = hasAnyRole(actor, STAFF_ROLES);
  const isFinance = hasAnyRole(actor, FINANCE_ROLES);

  const view: OrderView = {
    id: order.id,
    code: order.code,
    status: order.status,
    statusLabel: ORDER_STATUS_LABELS[order.status] ?? order.status,
    brand: order.brand,
    model: order.model,
    spec: order.spec,
    cartridgeType: order.cartridgeType,
    totalQuantity: order.totalQuantity,
    estimatePrice: order.estimatePrice,
    bOfferPrice: order.bOfferPrice,
    negotiatePrice: order.negotiatePrice,
    finalPrice: order.finalPrice,
    screenshots: order.screenshots ?? [],
    logistics: {
      no: order.logisticsNo,
      company: order.logisticsCompany,
      returnNo: order.returnLogisticsNo,
    },
    bEvalNote: order.bEvalNote,
    availableActions,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  };

  if (isStaff) {
    view.internalNote = order.internalNote;
  }
  if (isFinance) {
    view.payment = {
      billNo: order.transferBillNo,
      paidAt: order.paidAt ? order.paidAt.toISOString() : null,
    };
  }

  return view;
}
