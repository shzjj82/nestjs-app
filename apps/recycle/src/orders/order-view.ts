import {
  Actor,
  CartridgeType,
  ORDER_STATUS_LABELS,
  OrderStatus,
} from '../domain';
import type { RecycleOrderEntity } from '../entities';
import type { OrderAction } from '../policy/transitions';

export interface OrderPaymentView {
  billNo: string | null;
  wxBillNo: string | null;
  state: string | null;
  paidAt: string | null;
}

/** 小程序 wx.requestMerchantTransfer 所需参数 */
export interface MerchantTransferView {
  mchId: string;
  appId: string;
  package: string;
  outBillNo: string;
  state: string | null;
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
  /** 打款信息，业务员视角可见 */
  payment?: OrderPaymentView;
  /**
   * 用户确认收款参数；订单本人在待确认收款时可拿去调
   * wx.requestMerchantTransfer（package 来自微信发起转账接口）。
   */
  merchantTransfer?: MerchantTransferView | null;
  /** 当前调用者在该订单上可执行的动作 */
  availableActions: OrderAction[];
  /** 本次接口视角：customer=顾客权限，staff=业务员权限 */
  view: 'customer' | 'staff';
  createdAt: string;
  updatedAt: string;
}

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
  accessView: 'customer' | 'staff' = 'customer',
  extras?: { mchId?: string | null },
): OrderView {
  const showStaffFields = accessView === 'staff';
  const isOwner = actor.userId === order.ownerId;

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
    view: accessView,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  };

  if (showStaffFields) {
    view.internalNote = order.internalNote;
    view.payment = {
      billNo: order.transferBillNo,
      wxBillNo: order.transferWxBillNo,
      state: order.transferState,
      paidAt: order.paidAt ? order.paidAt.toISOString() : null,
    };
  }
  if (
    isOwner &&
    order.transferPackageInfo &&
    order.transferBillNo &&
    order.wechatAppId &&
    extras?.mchId
  ) {
    view.merchantTransfer = {
      mchId: extras.mchId,
      appId: order.wechatAppId,
      package: order.transferPackageInfo,
      outBillNo: order.transferBillNo,
      state: order.transferState,
    };
  }

  return view;
}
