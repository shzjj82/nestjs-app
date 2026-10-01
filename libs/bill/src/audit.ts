import type { BillDraft, BillItem } from './schema'
import {
  finalizeOcrBillDraft,
  parseBillDraftStructure,
  validateBillDraft,
  type FinalizeOcrBillResult,
} from './schema'

const TOLERANCE = 1

export type BillAuditFixKind =
  | 'already_balanced'
  /** 保留单品优惠，按图片整单实付反推 orderDiscount */
  | 'anchor_order_discount_to_paid'
  /** 整单里重复计入了已在 itemDiscount 的划线折扣：从 orderDiscount 扣除 */
  | 'dedupe_item_in_order_discount'
  | 'trim_order_discount'
  | 'fill_order_discount'
  /** @deprecated 不再自动清掉单品优惠 */
  | 'fold_item_discount_into_order'
  /** @deprecated 不再改 paidTotal；整单实付以图片为准 */
  | 'fix_paid_total'
  | 'merge_item_discount_into_order'
  /**
   * 全部商品行都用「划线−实付」写成大额 itemDiscount（实付 UI 误用）：
   * 清零 itemDiscount，并入 orderDiscount，保留 paidTotal。
   */
  | 'strip_shifu_derived_item_discounts'
  /**
   * quantity>1 时把行小计误当成单价（如茉莉奶绿 x2→¥24 写成 24×2）：
   * unitPrice 改为 小计÷quantity。
   */
  | 'fix_line_subtotal_as_unit_price'
  /**
   * 元→分多乘了 10：如 21.06 元写成 21060、30.14 写成 30140。
   * 商品/费用已是正确「分」时，仅把 paidTotal/orderDiscount ÷10。
   */
  | 'fix_extra_fen_scale'
  /**
   * 用「已优惠/共减」校准：纠正把行小计当单价（或相反）导致的优惠翻倍。
   */
  | 'calibrate_by_stated_discount'
  | 'none'

export type BillAuditPatch = Partial<
  Pick<BillDraft, 'orderDiscount' | 'paidTotal' | 'items'>
>

export type BillAuditHypothesis = {
  kind: BillAuditFixKind
  reason: string
  patch: BillAuditPatch
  expectedPaid: number
}

export type BillAuditReport = {
  ok: boolean
  lineGross: number
  itemDiscountSum: number
  lineNet: number
  deliveryFee: number
  packingFee: number
  orderDiscount: number
  paidTotal: number
  computedPaid: number
  gap: number
  hypotheses: BillAuditHypothesis[]
  summary: string
}

function moneyParts(data: BillDraft) {
  const lineGross = data.items.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0,
  )
  const itemDiscountSum = data.items.reduce(
    (sum, item) => sum + (item.itemDiscount ?? 0),
    0,
  )
  const lineNet = lineGross - itemDiscountSum
  const withFees = lineNet + data.deliveryFee + data.packingFee
  const withFeesGross = lineGross + data.deliveryFee + data.packingFee
  const computedPaid = withFees - data.orderDiscount
  const gap = computedPaid - data.paidTotal
  return {
    lineGross,
    itemDiscountSum,
    lineNet,
    withFees,
    withFeesGross,
    deliveryFee: data.deliveryFee,
    packingFee: data.packingFee,
    orderDiscount: data.orderDiscount,
    paidTotal: data.paidTotal,
    computedPaid,
    gap,
  }
}

function nearly(a: number, b: number): boolean {
  return Math.abs(a - b) <= TOLERANCE
}

/**
 * 自动检索金额是否自洽。
 * 原则：图片底部整单实付 paidTotal 为锚点，不改；尽量保留 itemDiscount，只调 orderDiscount。
 */
export function auditBillBalance(input: unknown): BillAuditReport | null {
  const structural = parseBillDraftStructure(input)
  if (!structural.ok) return null

  const data = structural.data
  const parts = moneyParts(data)
  const hypotheses: BillAuditHypothesis[] = []

  if (nearly(parts.computedPaid, parts.paidTotal) && parts.computedPaid >= 0) {
    hypotheses.push({
      kind: 'already_balanced',
      reason: '金额已自洽（以图片实付为准）',
      patch: {},
      expectedPaid: parts.paidTotal,
    })
    return {
      ok: true,
      ...parts,
      hypotheses,
      summary: formatSummary(parts, hypotheses),
    }
  }

  // H1: 以 paidTotal 为锚，反推 orderDiscount，保留全部 itemDiscount
  const anchoredOrder = parts.withFees - data.paidTotal
  if (anchoredOrder >= 0 && !nearly(anchoredOrder, data.orderDiscount)) {
    hypotheses.push({
      kind: 'anchor_order_discount_to_paid',
      reason: `图片整单实付 ${data.paidTotal} 分为准：保留单品优惠，orderDiscount 应为 ${anchoredOrder} 分`,
      patch: { orderDiscount: anchoredOrder },
      expectedPaid: data.paidTotal,
    })
  }

  // H2: 划线单品优惠被重复加进 orderDiscount → 从整单扣除，保留 itemDiscount
  if (
    parts.itemDiscountSum > 0 &&
    data.orderDiscount >= parts.itemDiscountSum
  ) {
    const nextOrder = data.orderDiscount - parts.itemDiscountSum
    const expected = parts.withFees - nextOrder
    if (nearly(expected, data.paidTotal) && expected >= 0) {
      hypotheses.push({
        kind: 'dedupe_item_in_order_discount',
        reason: `划线商品折扣已在 itemDiscount，orderDiscount 疑似重复计入：改为 ${nextOrder} 分`,
        patch: { orderDiscount: nextOrder },
        expectedPaid: expected,
      })
    }
  }

  // H3: 多扣 gap，削 orderDiscount
  if (parts.gap > TOLERANCE && data.orderDiscount >= parts.gap) {
    const nextOrder = data.orderDiscount - parts.gap
    if (
      nearly(parts.withFees - nextOrder, data.paidTotal) &&
      !hypotheses.some((h) => h.patch.orderDiscount === nextOrder)
    ) {
      hypotheses.push({
        kind: 'trim_order_discount',
        reason: `验算多扣 ${parts.gap} 分；建议 orderDiscount=${nextOrder}（不改单品优惠与实付）`,
        patch: { orderDiscount: nextOrder },
        expectedPaid: data.paidTotal,
      })
    }
  }

  // H4: 少记整单优惠
  if (parts.gap < -TOLERANCE) {
    const nextOrder = data.orderDiscount - parts.gap
    if (
      nextOrder > data.orderDiscount &&
      nearly(parts.withFees - nextOrder, data.paidTotal) &&
      !hypotheses.some((h) => h.patch.orderDiscount === nextOrder)
    ) {
      hypotheses.push({
        kind: 'fill_order_discount',
        reason: `整单优惠可能少记；以实付反推 orderDiscount=${nextOrder}`,
        patch: { orderDiscount: nextOrder },
        expectedPaid: data.paidTotal,
      })
    }
  }

  return {
    ok: false,
    ...parts,
    hypotheses,
    summary: formatSummary(parts, hypotheses),
  }
}

function formatSummary(
  parts: ReturnType<typeof moneyParts>,
  hypotheses: BillAuditHypothesis[],
): string {
  const lines = [
    `lineGross=${parts.lineGross}`,
    `itemDiscount合计=${parts.itemDiscountSum}`,
    `lineNet=${parts.lineNet}`,
    `deliveryFee=${parts.deliveryFee}`,
    `packingFee=${parts.packingFee}`,
    `orderDiscount=${parts.orderDiscount}`,
    `paidTotal=${parts.paidTotal}（图片整单实付，锚点不可改）`,
    `公式实付=${parts.computedPaid}`,
    `差额gap=${parts.gap}`,
    '保留单品划线优惠；不对齐时只调 orderDiscount；禁止清掉 itemDiscount；禁止改 paidTotal',
  ]
  if (hypotheses.length) {
    lines.push(
      '排查假设：' +
        hypotheses
          .filter((h) => h.kind !== 'already_balanced')
          .map((h) => `[${h.kind}] ${h.reason}`)
          .join(' | '),
    )
  } else {
    lines.push('排查假设：暂无自动匹配，请对照图片价格明细重读')
  }
  return lines.join('；')
}

/** 只动 orderDiscount，绝不清 itemDiscount、不改 paidTotal */
const AUTO_APPLY_PRIORITY: BillAuditFixKind[] = [
  'dedupe_item_in_order_discount',
  'anchor_order_discount_to_paid',
  'trim_order_discount',
  'fill_order_discount',
]

function applyPatch(data: BillDraft, patch: BillAuditPatch): BillDraft {
  return {
    ...data,
    ...patch,
    items: patch.items ?? data.items,
  }
}

/**
 * quantity>1 且把行小计误当成单价时，多算了 unitPrice×(qty−1)。
 * 用 paidTotal 差额匹配应对哪些行做 unitPrice = unitPrice÷qty（需整除）。
 * 例：茉莉 2400×2 多算 2400；奶冻已是 200×2 正确则不改。
 */
export function fixMisreadLineSubtotals(input: BillDraft): {
  data: BillDraft
  adjusted: boolean
  fixKind: BillAuditFixKind
} {
  const parts = moneyParts(input)
  const gap = parts.gap
  if (gap <= TOLERANCE) {
    return { data: input, adjusted: false, fixKind: 'already_balanced' }
  }

  type Candidate = { index: number; overcount: number; nextUnit: number }
  const candidates: Candidate[] = []
  for (let i = 0; i < input.items.length; i++) {
    const item = input.items[i]!
    if (item.quantity <= 1) continue
    if (item.unitPrice % item.quantity !== 0) continue
    const nextUnit = item.unitPrice / item.quantity
    if (nextUnit <= 0 || nextUnit === item.unitPrice) continue
    const overcount = item.unitPrice * (item.quantity - 1)
    if (overcount <= 0) continue
    candidates.push({ index: i, overcount, nextUnit })
  }
  if (!candidates.length) {
    return { data: input, adjusted: false, fixKind: 'already_balanced' }
  }

  candidates.sort((a, b) => b.overcount - a.overcount)
  let remaining = gap
  const chosen = new Set<number>()
  for (const c of candidates) {
    if (c.overcount <= remaining + TOLERANCE) {
      chosen.add(c.index)
      remaining -= c.overcount
      if (remaining <= TOLERANCE) break
    }
  }
  if (!chosen.size || remaining > TOLERANCE) {
    return { data: input, adjusted: false, fixKind: 'already_balanced' }
  }

  const items = input.items.map((item, index) => {
    if (!chosen.has(index)) return item
    const nextUnit = item.unitPrice / item.quantity
    return { ...item, unitPrice: nextUnit }
  })
  const next = { ...input, items }
  const checked = validateBillDraft(next)
  if (!checked.ok) {
    // 仍可能差在 orderDiscount：先交出改价结果，后续 anchor 再修
    const after = moneyParts(next)
    if (Math.abs(after.gap) < Math.abs(gap)) {
      return {
        data: next,
        adjusted: true,
        fixKind: 'fix_line_subtotal_as_unit_price',
      }
    }
    return { data: input, adjusted: false, fixKind: 'none' }
  }
  return {
    data: checked.data,
    adjusted: true,
    fixKind: 'fix_line_subtotal_as_unit_price',
  }
}

/**
 * 检测：每一行都有大额 itemDiscount（典型「实付/到手 − 原价」误写入单品优惠）。
 * 外卖常有打包费，天猫超市等可能没有——不再依赖 packingFee。
 * 不触发：仅部分商品有划线现价优惠（如一单里只有泡面打折）。
 */
export function looksLikeShifuDerivedItemDiscounts(data: BillDraft): boolean {
  if (data.items.length === 0) return false
  const ratios = data.items.map((item) => {
    const disc = item.itemDiscount ?? 0
    const gross = item.unitPrice * item.quantity
    if (gross <= 0 || disc <= 0) return 0
    return disc / gross
  })
  if (ratios.some((r) => r <= 0)) return false
  // 每行优惠占行原价比例都偏高（红包/券分摊进「实付」后常见 30%+）
  if (ratios.every((r) => r >= 0.3)) return true

  // 备选：每行都有优惠，且单品优惠合计≈整单应有优惠、orderDiscount 几乎为 0
  const lineGross = data.items.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0,
  )
  const itemDiscSum = data.items.reduce(
    (sum, item) => sum + (item.itemDiscount ?? 0),
    0,
  )
  const implied =
    lineGross + data.deliveryFee + data.packingFee - data.paidTotal
  if (implied <= 0) return false
  const orderTiny = data.orderDiscount <= Math.max(10, Math.floor(implied * 0.05))
  return (
    orderTiny && Math.abs(itemDiscSum - implied) <= Math.max(TOLERANCE, Math.floor(implied * 0.02))
  )
}

/**
 * 纠正「用商品行实付/到手推 itemDiscount」：清零单品优惠，按实付锚点写入 orderDiscount。
 */
export function stripShifuDerivedItemDiscounts(input: BillDraft): {
  data: BillDraft
  adjusted: boolean
  fixKind: BillAuditFixKind
} {
  if (!looksLikeShifuDerivedItemDiscounts(input)) {
    return { data: input, adjusted: false, fixKind: 'already_balanced' }
  }
  const items = input.items.map((item) => ({ ...item, itemDiscount: 0 }))
  const lineGross = items.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0,
  )
  const withFees = lineGross + input.deliveryFee + input.packingFee
  const neededOrderDiscount = withFees - input.paidTotal
  const next: BillDraft = {
    ...input,
    items,
    orderDiscount:
      neededOrderDiscount >= 0
        ? neededOrderDiscount
        : input.orderDiscount +
          input.items.reduce((sum, item) => sum + (item.itemDiscount ?? 0), 0),
  }
  const checked = validateBillDraft(next)
  if (!checked.ok) {
    return { data: input, adjusted: false, fixKind: 'none' }
  }
  return {
    data: checked.data,
    adjusted: true,
    fixKind: 'strip_shifu_derived_item_discounts',
  }
}

/**
 * @deprecated 旧打包费全量合并已取消；保留导出兼容。
 */
export function normalizePackingOrderDiscounts(input: BillDraft): {
  data: BillDraft
  adjusted: boolean
  fixKind: BillAuditFixKind
} {
  return stripShifuDerivedItemDiscounts(input)
}

export function finalizeOcrBillForApi(input: unknown): FinalizeOcrBillResult & {
  audit?: BillAuditReport
  fixKind?: BillAuditFixKind
} {
  return reconcileOcrBillDraft(input)
}

/**
 * 纠正「元→分」多乘 10：商品单价已是正确分，但实付/整单优惠多写一位 0。
 * 例：霸王茶姬优惠 21.06 元、实付 30.14 元 → 误成 21060 / 30140，应为 2106 / 3014。
 */
export function fixExtraFenScale(input: BillDraft): {
  data: BillDraft
  adjusted: boolean
  fixKind: BillAuditFixKind
} {
  if (validateBillDraft(input).ok) {
    return { data: input, adjusted: false, fixKind: 'already_balanced' }
  }

  const tryScale = (fields: Array<'paidTotal' | 'orderDiscount' | 'deliveryFee' | 'packingFee'>) => {
    const next: BillDraft = { ...input }
    for (const key of fields) {
      const value = input[key]
      if (value % 10 !== 0) return null
      next[key] = value / 10
    }
    const checked = validateBillDraft(next)
    return checked.ok ? checked.data : null
  }

  // 优先：仅实付 + 整单优惠（商品/运费/打包已正确）
  const paidAndDiscount = tryScale(['paidTotal', 'orderDiscount'])
  if (paidAndDiscount) {
    return {
      data: paidAndDiscount,
      adjusted: true,
      fixKind: 'fix_extra_fen_scale',
    }
  }

  // 其次：所有订单级金额都多乘了 10
  const allOrderMoney = tryScale([
    'paidTotal',
    'orderDiscount',
    'deliveryFee',
    'packingFee',
  ])
  if (allOrderMoney) {
    return {
      data: allOrderMoney,
      adjusted: true,
      fixKind: 'fix_extra_fen_scale',
    }
  }

  return { data: input, adjusted: false, fixKind: 'none' }
}

function withOrderDiscount(data: BillDraft, orderDiscount: number): BillDraft {
  return { ...data, orderDiscount, statedDiscount: data.statedDiscount }
}

/**
 * 用底部「已优惠/共减」校准单价 vs 行小计。
 * 典型：美团行小计被当成单价 → 行原价翻倍，orderDiscount 被撑到 54（页面写 18）。
 */
export function calibrateByStatedDiscount(input: BillDraft): {
  data: BillDraft
  adjusted: boolean
  fixKind: BillAuditFixKind
} {
  const stated = input.statedDiscount
  if (stated == null) {
    return { data: input, adjusted: false, fixKind: 'already_balanced' }
  }

  const discountAligned =
    Math.abs(input.orderDiscount - stated) <= TOLERANCE
  const balanced = validateBillDraft(input).ok
  if (discountAligned && balanced) {
    return { data: input, adjusted: false, fixKind: 'already_balanced' }
  }

  const anchored = withOrderDiscount(input, stated)
  if (validateBillDraft(anchored).ok) {
    return {
      data: anchored,
      adjusted: !discountAligned,
      fixKind: 'calibrate_by_stated_discount',
    }
  }

  // 美团/饿了么口径：把「当单价的行小计」÷quantity
  const dividedItems = input.items.map((item) => {
    if (item.quantity <= 1) return item
    if (item.unitPrice % item.quantity !== 0) return item
    return { ...item, unitPrice: item.unitPrice / item.quantity }
  })
  const asLineSubtotal = withOrderDiscount(
    { ...input, items: dividedItems },
    stated,
  )
  if (validateBillDraft(asLineSubtotal).ok) {
    return {
      data: asLineSubtotal,
      adjusted: true,
      fixKind: 'calibrate_by_stated_discount',
    }
  }

  // 京东口径：模型误 ÷quantity，再乘回来
  const multipliedItems = input.items.map((item) => {
    if (item.quantity <= 1) return item
    return { ...item, unitPrice: item.unitPrice * item.quantity }
  })
  const asUnitPrice = withOrderDiscount(
    { ...input, items: multipliedItems },
    stated,
  )
  if (validateBillDraft(asUnitPrice).ok) {
    return {
      data: asUnitPrice,
      adjusted: true,
      fixKind: 'calibrate_by_stated_discount',
    }
  }

  return { data: anchored, adjusted: true, fixKind: 'calibrate_by_stated_discount' }
}

/**
 * 无 statedDiscount 时：若把所有 qty>1 的单价÷数量后，用新行原价反推的优惠更合理则采用。
 * 判定：当前已平衡，但 ÷qty 后 neededDiscount 明显更小，且差值=行原价多算部分。
 * 仅对 meituan/eleme/unknown 尝试（京东右侧本就是单价，不能除）。
 */
export function fixAbsorbedLineSubtotalOnLineTotalChannels(input: BillDraft): {
  data: BillDraft
  adjusted: boolean
  fixKind: BillAuditFixKind
} {
  const channel = input.source
  if (channel === 'jd' || channel === 'taobao' || channel === 'tmall') {
    return { data: input, adjusted: false, fixKind: 'already_balanced' }
  }
  if (input.statedDiscount != null) {
    return { data: input, adjusted: false, fixKind: 'already_balanced' }
  }
  if (!validateBillDraft(input).ok) {
    return { data: input, adjusted: false, fixKind: 'already_balanced' }
  }

  const multi = input.items.filter((item) => item.quantity > 1)
  if (!multi.length) {
    return { data: input, adjusted: false, fixKind: 'already_balanced' }
  }
  if (
    multi.some(
      (item) =>
        item.unitPrice % item.quantity !== 0 ||
        item.unitPrice / item.quantity === item.unitPrice,
    )
  ) {
    return { data: input, adjusted: false, fixKind: 'already_balanced' }
  }

  const dividedItems = input.items.map((item) => {
    if (item.quantity <= 1) return item
    return { ...item, unitPrice: item.unitPrice / item.quantity }
  })
  const oldGross = input.items.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0,
  )
  const newGross = dividedItems.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0,
  )
  const overcount = oldGross - newGross
  if (overcount <= TOLERANCE) {
    return { data: input, adjusted: false, fixKind: 'already_balanced' }
  }

  const neededDiscount =
    newGross + input.deliveryFee + input.packingFee - input.paidTotal
  if (neededDiscount < 0) {
    return { data: input, adjusted: false, fixKind: 'already_balanced' }
  }
  // 当前优惠被多算的行原价「吸收」进去
  if (
    Math.abs(input.orderDiscount - neededDiscount - overcount) > TOLERANCE
  ) {
    return { data: input, adjusted: false, fixKind: 'already_balanced' }
  }
  // 新优惠应明显更小（避免对已正确账单再除一次：正确时 needed 往往≈0 且不满足吸收等式以外的业务合理性）
  // 正确账单再除：overcount 也会等于 orderDiscount - needed，会误伤。
  // 附加条件：至少两行 qty>1 都发生了除法，且 neededDiscount > 0（页面通常有红包）
  if (multi.length < 2 || neededDiscount <= TOLERANCE) {
    return { data: input, adjusted: false, fixKind: 'already_balanced' }
  }

  const next = withOrderDiscount(
    { ...input, items: dividedItems },
    neededDiscount,
  )
  const checked = validateBillDraft(next)
  if (!checked.ok) {
    return { data: input, adjusted: false, fixKind: 'none' }
  }
  return {
    data: checked.data,
    adjusted: true,
    fixKind: 'fix_line_subtotal_as_unit_price',
  }
}

/**
 * OCR 收尾：分位修正 → 已优惠校准 → 小计当单价 → 实付推单品优惠 → 实付锚调 orderDiscount。
 */
export function reconcileOcrBillDraft(input: unknown): FinalizeOcrBillResult & {
  audit?: BillAuditReport
  fixKind?: BillAuditFixKind
} {
  const structural = parseBillDraftStructure(input)
  if (!structural.ok) return structural

  const scaleFixed = fixExtraFenScale(structural.data)
  let cursor = scaleFixed.adjusted ? scaleFixed.data : structural.data
  let earlyFixKind: BillAuditFixKind | undefined = scaleFixed.adjusted
    ? scaleFixed.fixKind
    : undefined

  const calibrated = calibrateByStatedDiscount(cursor)
  if (calibrated.adjusted) {
    cursor = calibrated.data
    earlyFixKind = calibrated.fixKind
  }

  const absorbed = fixAbsorbedLineSubtotalOnLineTotalChannels(cursor)
  if (absorbed.adjusted) {
    cursor = absorbed.data
    earlyFixKind = absorbed.fixKind
  }

  const subtotalFixed = fixMisreadLineSubtotals(cursor)
  if (subtotalFixed.adjusted) {
    cursor = subtotalFixed.data
    earlyFixKind = subtotalFixed.fixKind
  }

  const stripped = stripShifuDerivedItemDiscounts(cursor)
  if (stripped.adjusted) {
    cursor = stripped.data
    earlyFixKind = stripped.fixKind
  }

  const base = cursor
  const anyEarly = Boolean(earlyFixKind && earlyFixKind !== 'already_balanced')

  const balanced = validateBillDraft(base)
  if (balanced.ok) {
    const audit = auditBillBalance(balanced.data)
    return {
      ok: true,
      data: balanced.data,
      adjusted: anyEarly,
      audit: audit ?? undefined,
      fixKind: earlyFixKind ?? 'already_balanced',
    }
  }

  const audit = auditBillBalance(base)
  if (!audit) {
    const fallback = finalizeOcrBillDraft(base)
    return {
      ...fallback,
      adjusted: Boolean((fallback.ok && fallback.adjusted) || anyEarly),
      fixKind:
        earlyFixKind ??
        (fallback.ok && fallback.adjusted ? 'anchor_order_discount_to_paid' : undefined),
    }
  }

  for (const kind of AUTO_APPLY_PRIORITY) {
    const hit = audit.hypotheses.find((h) => h.kind === kind)
    if (!hit) continue
    if (hit.patch.paidTotal !== undefined) continue
    if (hit.patch.items !== undefined) continue
    const next = applyPatch(base, hit.patch)
    const again = validateBillDraft(next)
    if (again.ok) {
      return {
        ok: true,
        data: again.data,
        adjusted: true,
        audit,
        fixKind: kind,
      }
    }
  }

  const fallback = finalizeOcrBillDraft(base)
  return {
    ...fallback,
    audit,
    adjusted: Boolean((fallback.ok && fallback.adjusted) || anyEarly),
    fixKind: anyEarly
      ? earlyFixKind
      : fallback.ok && fallback.adjusted
        ? 'anchor_order_discount_to_paid'
        : undefined,
  }
}

export function formatAuditForRepair(audit: BillAuditReport | null | undefined): string {
  if (!audit) return '（无验算报告）'
  return audit.summary
}

/** 供测试：清空单品优惠（仅测试/诊断，不进自动路径） */
export function __clearItemDiscountsForTest(items: BillItem[]): BillItem[] {
  return items.map((item) => ({ ...item, itemDiscount: 0 }))
}
