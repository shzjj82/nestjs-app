/**
 * 回收订单状态机
 *
 * 这些取值同时是数据库里的原生枚举类型 `recycle_order_status`，
 * 新增状态必须同时改这里和 `database/migrations` 下的迁移（ALTER TYPE ... ADD VALUE）。
 *
 *   draft        客户选品中（已选品牌型号，未获取报价）
 *   quoted       已获取预估报价
 *   submitted    客户已提交截图 + 物流单号，等待收货
 *   inspecting   业务员已收货，验收评估中
 *   evaluated    已验收并给出报价
 *   negotiating  客户发起协商定价，等待审批员决策
 *   accepted     客户同意报价，待客户发起收款
 *   paying       客户已发起商家转账，待微信确认收款
 *   paid         回收款已到账（微信转账 SUCCESS）
 *   rejected     已拒绝（验收不通过 / 客户拒绝报价 / 审批拒绝协商）
 *   returned     退货完成
 */
export enum OrderStatus {
  DRAFT = 'draft',
  QUOTED = 'quoted',
  SUBMITTED = 'submitted',
  INSPECTING = 'inspecting',
  EVALUATED = 'evaluated',
  NEGOTIATING = 'negotiating',
  ACCEPTED = 'accepted',
  PAYING = 'paying',
  PAID = 'paid',
  REJECTED = 'rejected',
  RETURNED = 'returned',
}

/** 写入 PostgreSQL 的枚举类型名 */
export const ORDER_STATUS_ENUM_NAME = 'recycle_order_status';

export const ORDER_STATUSES: OrderStatus[] = Object.values(OrderStatus);

/** 终态：不再接受任何动作 */
export const TERMINAL_STATUSES: OrderStatus[] = [
  OrderStatus.PAID,
  OrderStatus.RETURNED,
];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  [OrderStatus.DRAFT]: '选品中',
  [OrderStatus.QUOTED]: '已报价',
  [OrderStatus.SUBMITTED]: '待收货',
  [OrderStatus.INSPECTING]: '验收中',
  [OrderStatus.EVALUATED]: '已评估',
  [OrderStatus.NEGOTIATING]: '协商中',
  [OrderStatus.ACCEPTED]: '待收款',
  [OrderStatus.PAYING]: '确认收款中',
  [OrderStatus.PAID]: '已收款',
  [OrderStatus.REJECTED]: '已拒绝',
  [OrderStatus.RETURNED]: '已退货',
};

export function isOrderStatus(value: unknown): value is OrderStatus {
  return (
    typeof value === 'string' && ORDER_STATUSES.includes(value as OrderStatus)
  );
}

export function isTerminal(status: OrderStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}
