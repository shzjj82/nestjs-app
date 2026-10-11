import { rpcFail } from '@app/common';
import { CartridgeType } from './enums';
import { OrderStatus } from './order-status';

/**
 * 策略引擎看到的订单快照。
 *
 * 刻意与 TypeORM 实体解耦：policy 只依赖这个接口，
 * 换仓储实现（Postgres / 内存 / 测试桩）都不需要改策略。
 */
export interface OrderSnapshot {
  id: string;
  bizCode: string;
  status: OrderStatus;
  ownerId: string;
  assignedAgentId: string | null;
  regionCode: string | null;
  /** 整单预估回收价（分） */
  estimatePrice: number;
  /** 验收员报价（分） */
  bOfferPrice: number | null;
  /** 客户协商价（分） */
  negotiatePrice: number | null;
  /** 最终成交价（分） */
  finalPrice: number | null;
  /** 乐观锁版本号 */
  version: number;
}

/** 订单明细（一次回收可含多个不同品牌 / 类型的耗材） */
export interface OrderItemInput {
  typeId: string;
  brandId: string;
  modelId: string;
  cartridgeType: CartridgeType;
  brand: string;
  model: string;
  spec?: string;
  chip?: boolean;
  quantity: number;
  /** 单支预估回收价（分） */
  price: number;
}

/** 验收项勾选 */
export interface AuditItemInput {
  name: string;
  pass: boolean;
  note?: string;
}

/** 从载荷读取正整数金额（分） */
export function readCents(
  payload: Record<string, unknown>,
  field: string,
): number {
  const raw = payload[field];
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0 || !Number.isInteger(value)) {
    rpcFail(400, `${field} 必须是大于 0 的整数（单位：分）`);
  }
  return value;
}

export function optionalCents(
  payload: Record<string, unknown>,
  field: string,
): number | null {
  if (
    payload[field] === undefined ||
    payload[field] === null ||
    payload[field] === ''
  ) {
    return null;
  }
  return readCents(payload, field);
}

export function formatYuan(cents: number): string {
  return (cents / 100).toFixed(2);
}
