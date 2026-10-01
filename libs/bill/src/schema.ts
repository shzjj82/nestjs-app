import { z } from 'zod'

/** 金额单位：分（整数，避免浮点误差） */
export const MoneyFenSchema = z
  .number()
  .int('金额须为整数（分）')
  .nonnegative('金额不能为负数')

export const BillItemSchema = z.object({
  name: z.string().min(1, '请填写商品名称'),
  unitPrice: MoneyFenSchema,
  quantity: z.number().int().positive('数量至少为 1'),
  /**
   * 单品优惠（分）：整行总额，不随 quantity 自动倍增。
   * 仅来自行上「非实付/非到手」现价相对划线的差额（如泡面促销价）。
   * 「实付/到手」分摊价不算；价格明细优惠进 orderDiscount。
   */
  itemDiscount: MoneyFenSchema.optional().default(0),
  /**
   * 是否参与平摊打包费。默认 true；小料等可取消勾选。
   * 打包费按参与行的件数均摊；若全部为 false，则回退为全部行按件数摊。
   */
  bearsPacking: z.boolean().optional().default(true),
})

export const BillDraftSchema = z.object({
  items: z.array(BillItemSchema).min(1, '请至少添加一件商品'),
  /** 整单优惠（含明细商品优惠/红包/支付/配送费优惠/店铺活动等），按行净额比例平摊 */
  orderDiscount: MoneyFenSchema.default(0),
  deliveryFee: MoneyFenSchema.default(0),
  packingFee: MoneyFenSchema.default(0),
  /** 实付总额（分），用于前端校验 */
  paidTotal: MoneyFenSchema,
  currencyUnit: z.literal('fen').default('fen'),
  source: z.preprocess((value) => {
    if (value == null || value === '') return 'unknown'
    if (typeof value !== 'string') return 'unknown'
    const key = value.trim().toLowerCase()
    const aliases: Record<string, string> = {
      meituan: 'meituan',
      eleme: 'eleme',
      wechat: 'wechat',
      taobao: 'taobao',
      tmall: 'tmall',
      jd: 'jd',
      jingdong: 'jd',
      '天猫': 'tmall',
      '天猫超市': 'tmall',
      '淘宝': 'taobao',
      '淘宝闪购': 'taobao',
      '京东': 'jd',
      '京东外卖': 'jd',
      manual: 'manual',
      unknown: 'unknown',
    }
    return aliases[key] ?? 'unknown'
  }, z.enum(['meituan', 'eleme', 'wechat', 'taobao', 'tmall', 'jd', 'manual', 'unknown']).default('unknown')),
  /**
   * 图片底部「已优惠 / 共减」金额（分）。用于校准单价 vs 行小计，不参与前端手工录入。
   */
  statedDiscount: MoneyFenSchema.optional(),
  confidence: z.number().min(0).max(1).optional(),
})

export type BillItem = z.infer<typeof BillItemSchema>
export type BillDraft = z.infer<typeof BillDraftSchema>

export type ValidationIssue = {
  path: string
  message: string
}

export type ValidateBillDraftResult =
  | { ok: true; data: BillDraft }
  | { ok: false; errors: ValidationIssue[] }

/** 仅校验字段结构（OCR 填表用）；不做金额平衡 */
export function parseBillDraftStructure(input: unknown): ValidateBillDraftResult {
  const parsed = BillDraftSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((issue) => ({
        path: issue.path.join('.') || '(root)',
        message: issue.message,
      })),
    }
  }
  return { ok: true, data: parsed.data }
}

function lineNetOf(data: BillDraft): number {
  return data.items.reduce((sum, item) => {
    return sum + item.unitPrice * item.quantity - (item.itemDiscount ?? 0)
  }, 0)
}

export type FinalizeOcrBillResult = ValidateBillDraftResult & {
  /** 是否做过数学自洽调整（如去掉重复整单优惠） */
  adjusted?: boolean
}

/**
 * OCR 收尾：图片整单实付 paidTotal 为锚点，不改动；保留 itemDiscount；
 * 用 orderDiscount = 行净额 + 费用 − paidTotal 对齐。
 */
export function finalizeOcrBillDraft(input: unknown): FinalizeOcrBillResult {
  const structural = parseBillDraftStructure(input)
  if (!structural.ok) return structural

  const balanced = validateBillDraft(structural.data)
  if (balanced.ok) return balanced

  const data = structural.data
  const net = lineNetOf(data)
  const withFees = net + data.deliveryFee + data.packingFee
  const neededOrderDiscount = withFees - data.paidTotal
  let adjusted = false
  let next = data

  if (neededOrderDiscount >= 0 && Math.abs(neededOrderDiscount - data.orderDiscount) > 1) {
    next = { ...data, orderDiscount: neededOrderDiscount }
    adjusted = true
  }

  const again = validateBillDraft(next)
  if (again.ok) {
    return { ok: true, data: again.data, adjusted }
  }

  return again
}

function fenToYuanLabel(fen: number): string {
  return `¥${(fen / 100).toFixed(2)}`
}

/**
 * 校验订单草稿 JSON（含金额平衡）。手工「计算」走此校验。
 */
export function validateBillDraft(input: unknown): ValidateBillDraftResult {
  const structural = parseBillDraftStructure(input)
  if (!structural.ok) return structural

  const data = structural.data
  const itemsSubtotal = lineNetOf(data)
  const expectedPaid =
    itemsSubtotal + data.deliveryFee + data.packingFee - data.orderDiscount

  if (Math.abs(expectedPaid - data.paidTotal) > 1) {
    return {
      ok: false,
      errors: [
        {
          path: 'paidTotal',
          message: `实付金额对不上，请检查单价、优惠、配送和打包费（按填写计算约 ${fenToYuanLabel(expectedPaid)}，当前实付 ${fenToYuanLabel(data.paidTotal)}）`,
        },
      ],
    }
  }

  return { ok: true, data }
}
