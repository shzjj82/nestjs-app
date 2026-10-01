import type { BillDraft } from './schema'
import { allocateByWeight, splitBill } from './split'

function sumBy<T>(items: T[], pick: (item: T) => number): number {
  let total = 0
  for (const item of items) total += pick(item)
  return total
}

describe('allocateByWeight', () => {
  it('sums exactly to total', () => {
    const result = allocateByWeight(100, { a: 2, b: 1 })
    expect(result.a! + result.b!).toBe(100)
    expect(result.a).toBe(67)
    expect(result.b).toBe(33)
  })
})

describe('splitBill', () => {
  it('allocates discount and fees to each item so sum equals paidTotal', () => {
    const bill: BillDraft = {
      items: [
        { name: 'A菜', unitPrice: 10000, quantity: 1, itemDiscount: 0 },
        { name: 'B菜', unitPrice: 5000, quantity: 1, itemDiscount: 0 },
      ],
      orderDiscount: 3000,
      deliveryFee: 600,
      packingFee: 0,
      paidTotal: 12600,
      currencyUnit: 'fen',
      source: 'manual',
    }
    // 10000+5000+600-3000 = 12600
    const result = splitBill(bill)
    expect(sumBy(result.items, (i) => i.finalAmount)).toBe(12600)

    const a = result.items[0]!
    const b = result.items[1]!
    // 优惠按 10000:5000 → 2000 / 1000；配送按同比例 → 400 / 200
    // A: 10000 - 2000 + 400 = 8400
    // B: 5000 - 1000 + 200 = 4200
    expect(a.finalAmount).toBe(8400)
    expect(b.finalAmount).toBe(4200)
    expect(a.finalUnitPrice).toBe(8400)
    expect(b.finalUnitPrice).toBe(4200)
  })

  it('handles quantity > 1', () => {
    const bill: BillDraft = {
      items: [
        { name: '米饭', unitPrice: 200, quantity: 2, itemDiscount: 0 },
      ],
      orderDiscount: 0,
      deliveryFee: 0,
      packingFee: 0,
      paidTotal: 400,
      currencyUnit: 'fen',
      source: 'manual',
    }
    const result = splitBill(bill)
    expect(result.items[0]!.finalAmount).toBe(400)
    expect(result.items[0]!.finalUnitPrice).toBe(200)
  })

  it('keeps SKU strikethrough discount on that item (not shared as orderDiscount)', () => {
    // 泡面划线优惠 444 记在 itemDiscount；运费按行净额摊，不把泡面优惠摊给另一道菜
    const bill: BillDraft = {
      items: [
        { name: '日清泡面', unitPrice: 1590, quantity: 1, itemDiscount: 444 },
        { name: '普通饮料', unitPrice: 1000, quantity: 1, itemDiscount: 0 },
      ],
      orderDiscount: 0,
      deliveryFee: 500,
      packingFee: 0,
      // nets: 1146 + 1000 = 2146；+500 = 2646
      paidTotal: 2646,
      currencyUnit: 'fen',
      source: 'meituan',
    }
    const result = splitBill(bill)
    const noodle = result.items[0]!
    const drink = result.items[1]!

    expect(noodle.itemDiscount).toBe(444)
    expect(drink.itemDiscount).toBe(0)
    // 配送按净额 1146:1000 摊，不是按原价 1590:1000
    expect(noodle.deliveryShare + drink.deliveryShare).toBe(500)
    expect(noodle.deliveryShare).toBe(267)
    expect(drink.deliveryShare).toBe(233)
    // 泡面最终 = 1146 + 267；饮料 = 1000 + 233
    expect(noodle.finalAmount).toBe(1413)
    expect(drink.finalAmount).toBe(1233)
    expect(sumBy(result.items, (i) => i.finalAmount)).toBe(2646)
  })

  it('allocates packingFee only to items with bearsPacking', () => {
    const bill: BillDraft = {
      items: [
        { name: '奶茶', unitPrice: 1500, quantity: 2, itemDiscount: 0, bearsPacking: true },
        { name: '小料', unitPrice: 200, quantity: 3, itemDiscount: 0, bearsPacking: false },
      ],
      orderDiscount: 0,
      deliveryFee: 0,
      packingFee: 200,
      // nets 3000+600=3600；+200 packing = 3800
      paidTotal: 3800,
      currencyUnit: 'fen',
      source: 'manual',
    }
    const result = splitBill(bill)
    const tea = result.items[0]!
    const topping = result.items[1]!

    expect(tea.packingShare).toBe(200)
    expect(topping.packingShare).toBe(0)
    expect(tea.finalAmount).toBe(3200)
    expect(topping.finalAmount).toBe(600)
    expect(sumBy(result.items, (i) => i.finalAmount)).toBe(3800)
  })

  it('allocates packingFee by quantity, not by net amount', () => {
    // 贵的 1 件 vs 便宜的 2 件：按数量应为 1:2，不是按净额 3000:1000
    const bill: BillDraft = {
      items: [
        { name: '贵的', unitPrice: 3000, quantity: 1, itemDiscount: 0, bearsPacking: true },
        { name: '便宜的', unitPrice: 500, quantity: 2, itemDiscount: 0, bearsPacking: true },
      ],
      orderDiscount: 0,
      deliveryFee: 0,
      packingFee: 300,
      // nets 3000+1000=4000；+300 = 4300
      paidTotal: 4300,
      currencyUnit: 'fen',
      source: 'manual',
    }
    const result = splitBill(bill)
    expect(result.items[0]!.packingShare).toBe(100)
    expect(result.items[1]!.packingShare).toBe(200)
    expect(sumBy(result.items, (i) => i.finalAmount)).toBe(4300)
  })

  it('falls back to all items by quantity when nobody bears packing', () => {
    const bill: BillDraft = {
      items: [
        { name: 'A', unitPrice: 1000, quantity: 1, itemDiscount: 0, bearsPacking: false },
        { name: 'B', unitPrice: 1000, quantity: 2, itemDiscount: 0, bearsPacking: false },
      ],
      orderDiscount: 0,
      deliveryFee: 0,
      packingFee: 90,
      paidTotal: 3090,
      currencyUnit: 'fen',
      source: 'manual',
    }
    const result = splitBill(bill)
    expect(result.items[0]!.packingShare).toBe(30)
    expect(result.items[1]!.packingShare).toBe(60)
    expect(sumBy(result.items, (i) => i.finalAmount)).toBe(3090)
  })
})
