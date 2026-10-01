import type { BillDraft, BillItem } from './schema'

function sumBy<T>(items: T[], pick: (item: T) => number): number {
  let total = 0
  for (const item of items) total += pick(item)
  return total
}

export type ItemPrice = {
  index: number
  name: string
  quantity: number
  /** 原价小计（分）= unitPrice * quantity */
  originalSubtotal: number
  /** 单品优惠（分） */
  itemDiscount: number
  /** 分摊到的整单优惠（分） */
  orderDiscountShare: number
  /** 分摊到的配送费（分） */
  deliveryShare: number
  /** 分摊到的餐盒费（分） */
  packingShare: number
  /** 是否参与平摊打包费（默认 true） */
  bearsPacking: boolean
  /** 该行最终应付（分） */
  finalAmount: number
  /** 折合单价（分）= finalAmount / quantity（整数除法取整后的展示用单价） */
  finalUnitPrice: number
}

export type SplitResult = {
  items: ItemPrice[]
  paidTotal: number
}

function itemLineNet(item: BillItem): number {
  return item.unitPrice * item.quantity - (item.itemDiscount ?? 0)
}

/**
 * 最大余额法：按权重把 total 分到各方，保证整数分之和精确等于 total。
 */
export function allocateByWeight(
  total: number,
  weights: Record<string, number>,
): Record<string, number> {
  const ids = Object.keys(weights)
  const weightSum = sumBy(ids, (id) => Math.max(0, weights[id] ?? 0))
  const result: Record<string, number> = {}

  if (ids.length === 0) return result
  if (weightSum <= 0 || total === 0) {
    for (const id of ids) result[id] = 0
    if (total !== 0 && ids.length > 0) {
      const base = Math.floor(total / ids.length)
      let rem = total - base * ids.length
      for (const id of ids) {
        result[id] = base + (rem > 0 ? 1 : 0)
        if (rem > 0) rem -= 1
      }
    }
    return result
  }

  const exact = ids.map((id) => {
    const w = Math.max(0, weights[id] ?? 0)
    const raw = (total * w) / weightSum
    const floor = Math.floor(raw)
    return { id, floor, frac: raw - floor }
  })

  let remain = total - sumBy(exact, (e) => e.floor)
  exact.sort((a, b) => b.frac - a.frac)

  for (const e of exact) {
    result[e.id] = e.floor
  }
  for (let i = 0; i < exact.length && remain > 0; i += 1) {
    result[exact[i]!.id] += 1
    remain -= 1
  }
  for (let i = exact.length - 1; i >= 0 && remain < 0; i -= 1) {
    result[exact[i]!.id] -= 1
    remain += 1
  }

  return result
}

/**
 * 不区分人：整单优惠、配送费按各行净额比例摊；
 * 餐盒费按「参与平摊」行的数量均摊（不按金额比例）。
 * 只摊给 bearsPacking !== false 的行（默认全部参与）；
 * 若无人勾选，则回退为全部行按数量摊。
 * 行净额 = unitPrice×quantity − itemDiscount。
 * 保证 Σ finalAmount === paidTotal。
 */
export function splitBill(bill: BillDraft): SplitResult {
  const nets = bill.items.map((item) => itemLineNet(item))
  const weights = Object.fromEntries(
    nets.map((net, index) => [String(index), Math.max(0, net)]),
  )

  // 打包费权重 = 件数；未勾选参与则为 0
  const packingQtyWeights = Object.fromEntries(
    bill.items.map((item, index) => {
      const bears = item.bearsPacking !== false
      return [String(index), bears ? Math.max(0, item.quantity) : 0]
    }),
  )
  const packingQtySum = sumBy(Object.keys(packingQtyWeights), (id) => packingQtyWeights[id] ?? 0)
  const allQtyWeights = Object.fromEntries(
    bill.items.map((item, index) => [String(index), Math.max(0, item.quantity)]),
  )
  const effectivePackingWeights = packingQtySum > 0 ? packingQtyWeights : allQtyWeights

  const orderDiscountShares = allocateByWeight(bill.orderDiscount, weights)
  const deliveryShares = allocateByWeight(bill.deliveryFee, weights)
  const packingShares = allocateByWeight(bill.packingFee, effectivePackingWeights)

  const items: ItemPrice[] = bill.items.map((item, index) => {
    const key = String(index)
    const originalSubtotal = item.unitPrice * item.quantity
    const itemDiscount = item.itemDiscount ?? 0
    const orderDiscountShare = orderDiscountShares[key] ?? 0
    const deliveryShare = deliveryShares[key] ?? 0
    const packingShare = packingShares[key] ?? 0
    const finalAmount =
      nets[index]! - orderDiscountShare + deliveryShare + packingShare

    return {
      index,
      name: item.name,
      quantity: item.quantity,
      originalSubtotal,
      itemDiscount,
      orderDiscountShare,
      deliveryShare,
      packingShare,
      bearsPacking: item.bearsPacking !== false,
      finalAmount,
      finalUnitPrice: Math.floor(finalAmount / item.quantity),
    }
  })

  // 抹平到 paidTotal
  const currentSum = sumBy(items, (i) => i.finalAmount)
  let delta = bill.paidTotal - currentSum
  if (delta !== 0 && items.length > 0) {
    const sorted = [...items].sort((a, b) => b.finalAmount - a.finalAmount)
    const target = items.find((i) => i.index === sorted[0]!.index)!
    target.finalAmount += delta
    target.finalUnitPrice = Math.floor(target.finalAmount / target.quantity)
  }

  return { items, paidTotal: bill.paidTotal }
}
