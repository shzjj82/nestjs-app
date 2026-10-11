import { optionalString, rpcFail } from '@app/common';

export interface QuoteRequestItem {
  typeId?: string;
  brandId?: string;
  modelId: string;
  quantity: number;
}

const MAX_ITEMS = 50;
const MAX_QUANTITY = 999;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function requireId(value: unknown, field: string): string {
  const raw = optionalString(value);
  if (!raw || !UUID_RE.test(raw)) {
    rpcFail(400, `${field} 必填`);
  }
  return raw;
}

export function optionalId(value: unknown, field: string): string | undefined {
  const raw = optionalString(value);
  if (!raw) return undefined;
  if (!UUID_RE.test(raw)) {
    rpcFail(400, `${field} 非法`);
  }
  return raw;
}

/** 客户端只报 modelId 与数量；typeId / brandId 可选，用来校验没选串行 */
export function readQuoteItems(raw: unknown): QuoteRequestItem[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    rpcFail(400, '请先添加要回收的耗材');
  }
  if (raw.length > MAX_ITEMS) {
    rpcFail(400, `单次最多 ${MAX_ITEMS} 个型号`);
  }
  return (raw as unknown[]).map((entry) => {
    const row = (entry ?? {}) as Record<string, unknown>;
    const quantity = Number(row.quantity);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      rpcFail(400, 'quantity 必须为正整数');
    }
    if (quantity > MAX_QUANTITY) {
      rpcFail(400, `单个型号数量不能超过 ${MAX_QUANTITY}`);
    }
    return {
      modelId: requireId(row.modelId, 'modelId'),
      typeId: optionalId(row.typeId, 'typeId'),
      brandId: optionalId(row.brandId, 'brandId'),
      quantity,
    };
  });
}
