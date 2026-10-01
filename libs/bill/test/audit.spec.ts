import { auditBillBalance, reconcileOcrBillDraft } from '../src/audit'
import { finalizeOcrBillDraft } from '../src/schema'

describe('auditBillBalance', () => {
  it('keeps itemDiscount and dedupes orderDiscount when strikethrough is double-counted', () => {
    // 划线单品 534 已在 itemDiscount，活动优惠又进了 orderDiscount
    const result = reconcileOcrBillDraft({
      items: [
        { name: '日清泡面', unitPrice: 1680, quantity: 1, itemDiscount: 534 },
        { name: '提拉米苏', unitPrice: 1090, quantity: 1, itemDiscount: 0 },
      ],
      orderDiscount: 534,
      deliveryFee: 0,
      packingFee: 0,
      paidTotal: 2236,
      currencyUnit: 'fen',
      source: 'meituan',
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.items[0]!.itemDiscount).toBe(534)
      expect(result.data.orderDiscount).toBe(0)
      expect(result.data.paidTotal).toBe(2236)
      expect(result.adjusted).toBe(true)
    }
  })

  it('accepts correct CHAGEE classification without changes', () => {
    const result = reconcileOcrBillDraft({
      items: [
        {
          name: '双大杯套餐',
          unitPrice: 4400,
          quantity: 1,
          itemDiscount: 0,
        },
      ],
      orderDiscount: 2106,
      deliveryFee: 520,
      packingFee: 200,
      paidTotal: 3014,
      currencyUnit: 'fen',
      source: 'meituan',
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.items[0]!.itemDiscount).toBe(0)
      expect(result.data.orderDiscount).toBe(2106)
      expect(result.fixKind).toBe('already_balanced')
      expect(result.adjusted).toBeFalsy()
    }
  })

  it('anchors orderDiscount to image paidTotal without clearing itemDiscount', () => {
    // 单品划线优惠保留；整单优惠少记 → 用实付反推
    const result = reconcileOcrBillDraft({
      items: [
        { name: '日清泡面', unitPrice: 1680, quantity: 1, itemDiscount: 534 },
        { name: '饮料', unitPrice: 1000, quantity: 1, itemDiscount: 0 },
      ],
      orderDiscount: 0,
      deliveryFee: 500,
      packingFee: 0,
      paidTotal: 2446,
      currencyUnit: 'fen',
      source: 'meituan',
    })
    // nets 1146+1000+500=2646；paid 2446 → orderDiscount 应为 200
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.items[0]!.itemDiscount).toBe(534)
      expect(result.data.orderDiscount).toBe(200)
      expect(result.data.paidTotal).toBe(2446)
    }
  })

  it('does not wipe itemDiscount when packingFee > 0', () => {
    // 曾经错误地把有打包费单的 itemDiscount 全部并进整单
    const result = reconcileOcrBillDraft({
      items: [
        { name: '套餐A', unitPrice: 5000, quantity: 1, itemDiscount: 800 },
        { name: '套餐B', unitPrice: 3000, quantity: 1, itemDiscount: 0 },
      ],
      orderDiscount: 500,
      deliveryFee: 600,
      packingFee: 200,
      // 4200+3000+600+200-500 = 7500
      paidTotal: 7500,
      currencyUnit: 'fen',
      source: 'meituan',
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.items[0]!.itemDiscount).toBe(800)
      expect(result.data.orderDiscount).toBe(500)
      expect(result.data.paidTotal).toBe(7500)
      expect(result.fixKind).toBe('already_balanced')
    }
  })

  it('lists anchor hypothesis when orderDiscount wrong vs paidTotal', () => {
    const audit = auditBillBalance({
      items: [
        {
          name: '双大杯套餐',
          unitPrice: 4400,
          quantity: 1,
          itemDiscount: 0,
        },
      ],
      orderDiscount: 1000,
      deliveryFee: 520,
      packingFee: 200,
      paidTotal: 3014,
      currencyUnit: 'fen',
      source: 'meituan',
    })
    expect(audit).not.toBeNull()
    expect(audit!.ok).toBe(false)
    expect(
      audit!.hypotheses.some((h) => h.kind === 'anchor_order_discount_to_paid'),
    ).toBe(true)
  })

  it('calibrates 美团行小计被当成单价 using statedDiscount 已优惠18', () => {
    // 真实末单：右侧 30/4/2 是 x2 小计；模型写成单价导致优惠 54；页面已优惠 18
    const result = reconcileOcrBillDraft({
      items: [
        { name: '茉莉奶绿', unitPrice: 3000, quantity: 2, itemDiscount: 0 },
        { name: '奶冻', unitPrice: 400, quantity: 2, itemDiscount: 0 },
        { name: '冻冻', unitPrice: 200, quantity: 2, itemDiscount: 0 },
      ],
      orderDiscount: 5400,
      statedDiscount: 1800,
      deliveryFee: 470,
      packingFee: 200,
      paidTotal: 2470,
      currencyUnit: 'fen',
      source: 'meituan',
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.items[0]!.unitPrice).toBe(1500)
      expect(result.data.items[1]!.unitPrice).toBe(200)
      expect(result.data.items[2]!.unitPrice).toBe(100)
      expect(result.data.orderDiscount).toBe(1800)
      expect(result.data.paidTotal).toBe(2470)
      expect(result.fixKind).toBe('calibrate_by_stated_discount')
    }
  })

  it('fixes absorbed line-subtotal error on meituan without statedDiscount', () => {
    const result = reconcileOcrBillDraft({
      items: [
        { name: '茉莉奶绿', unitPrice: 3000, quantity: 2, itemDiscount: 0 },
        { name: '奶冻', unitPrice: 400, quantity: 2, itemDiscount: 0 },
        { name: '冻冻', unitPrice: 200, quantity: 2, itemDiscount: 0 },
      ],
      orderDiscount: 5400,
      deliveryFee: 470,
      packingFee: 200,
      paidTotal: 2470,
      currencyUnit: 'fen',
      source: 'meituan',
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.items[0]!.unitPrice).toBe(1500)
      expect(result.data.orderDiscount).toBe(1800)
      expect(result.fixKind).toBe('fix_line_subtotal_as_unit_price')
    }
  })

  it('does not re-divide already-correct meituan multi-qty prices', () => {
    const result = reconcileOcrBillDraft({
      items: [
        { name: '茉莉奶绿', unitPrice: 1200, quantity: 2, itemDiscount: 0 },
        { name: '奶冻', unitPrice: 200, quantity: 2, itemDiscount: 0 },
      ],
      orderDiscount: 1400,
      deliveryFee: 380,
      packingFee: 200,
      paidTotal: 1980,
      currencyUnit: 'fen',
      source: 'meituan',
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.items[0]!.unitPrice).toBe(1200)
      expect(result.data.items[1]!.unitPrice).toBe(200)
      expect(result.fixKind).toBe('already_balanced')
    }
  })

  it('fixes 元→分 extra ×10 on paidTotal/orderDiscount (霸王茶姬)', () => {
    // 21.06 元 / 30.14 元 误写成 21060 / 30140；商品 44 元、运费 5.2、打包 2 已正确
    const result = reconcileOcrBillDraft({
      items: [
        {
          name: '【夏日随心配】双大杯套餐',
          unitPrice: 4400,
          quantity: 1,
          itemDiscount: 0,
        },
      ],
      orderDiscount: 21060,
      deliveryFee: 520,
      packingFee: 200,
      paidTotal: 30140,
      currencyUnit: 'fen',
      source: 'eleme',
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.orderDiscount).toBe(2106)
      expect(result.data.paidTotal).toBe(3014)
      expect(result.data.items[0]!.unitPrice).toBe(4400)
      expect(result.fixKind).toBe('fix_extra_fen_scale')
    }
  })

  it('strips 天猫超市 实付分摊 itemDiscount（无打包费）into orderDiscount', () => {
    // 真实 job IIU0neCnKW6kyl1F：把原价−实付写进每行 itemDiscount，orderDiscount≈0
    const result = reconcileOcrBillDraft({
      items: [
        { name: '海底捞自热火锅', unitPrice: 6990, quantity: 1, itemDiscount: 2167 },
        { name: 'Edo便携餐具', unitPrice: 2490, quantity: 1, itemDiscount: 1516 },
        { name: '美丽雅垃圾袋', unitPrice: 5490, quantity: 1, itemDiscount: 2913 },
      ],
      orderDiscount: 4,
      deliveryFee: 0,
      packingFee: 0,
      paidTotal: 8370,
      currencyUnit: 'fen',
      source: 'tmall',
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.items.every((i) => i.itemDiscount === 0)).toBe(true)
      expect(result.data.orderDiscount).toBe(6600)
      expect(result.data.paidTotal).toBe(8370)
      expect(result.fixKind).toBe('strip_shifu_derived_item_discounts')
    }
  })

  it('strips KFC-style 划线−实付 itemDiscounts into orderDiscount', () => {
    // 日志真实错误：把商品行实付差额写成 itemDiscount
    const result = reconcileOcrBillDraft({
      items: [
        { name: '辣堡烤堡2件套', unitPrice: 4850, quantity: 1, itemDiscount: 2437 },
        { name: '避风塘大虾塔可2个', unitPrice: 5000, quantity: 1, itemDiscount: 2749 },
        { name: '吮指原味鸡3块', unitPrice: 4650, quantity: 1, itemDiscount: 3044 },
      ],
      orderDiscount: 0,
      deliveryFee: 600,
      packingFee: 630,
      paidTotal: 7500,
      currencyUnit: 'fen',
      source: 'meituan',
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.items.every((i) => i.itemDiscount === 0)).toBe(true)
      expect(result.data.orderDiscount).toBe(2437 + 2749 + 3044)
      expect(result.data.paidTotal).toBe(7500)
      expect(result.fixKind).toBe('strip_shifu_derived_item_discounts')
    }
  })

  it('does not strip when only one SKU has promo (泡面)', () => {
    const result = reconcileOcrBillDraft({
      items: [
        { name: '日清泡面', unitPrice: 1680, quantity: 1, itemDiscount: 534 },
        { name: '提拉米苏', unitPrice: 1090, quantity: 1, itemDiscount: 0 },
      ],
      orderDiscount: 0,
      deliveryFee: 0,
      packingFee: 200,
      paidTotal: 2436,
      currencyUnit: 'fen',
      source: 'meituan',
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.items[0]!.itemDiscount).toBe(534)
      expect(result.fixKind).not.toBe('strip_shifu_derived_item_discounts')
    }
  })

  it('fixes 茉莉 x2¥24 misread as unit price while keeping 奶冻 x2¥4', () => {
    // 模型常：茉莉 unitPrice=2400×2；奶冻已正确 unitPrice=200×2
    const result = reconcileOcrBillDraft({
      items: [
        { name: '茉莉奶绿', unitPrice: 2400, quantity: 2, itemDiscount: 0 },
        { name: '奶冻', unitPrice: 200, quantity: 2, itemDiscount: 0 },
      ],
      orderDiscount: 1400,
      deliveryFee: 380,
      packingFee: 200,
      paidTotal: 1980,
      currencyUnit: 'fen',
      source: 'meituan',
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.items[0]!.unitPrice).toBe(1200)
      expect(result.data.items[0]!.quantity).toBe(2)
      expect(result.data.items[1]!.unitPrice).toBe(200)
      expect(result.data.paidTotal).toBe(1980)
      expect(result.data.orderDiscount).toBe(1400)
      expect(result.fixKind).toBe('fix_line_subtotal_as_unit_price')
    }
  })

  it('strips 到手-derived itemDiscount (原价−到手) into orderDiscount', () => {
    // 模型误用：unitPrice=原价，itemDiscount=原价−到手；券应在 orderDiscount
    const result = reconcileOcrBillDraft({
      items: [
        { name: '茉莉奶绿', unitPrice: 1500, quantity: 1, itemDiscount: 720 },
        { name: '奶冻', unitPrice: 200, quantity: 2, itemDiscount: 290 },
      ],
      orderDiscount: 170,
      deliveryFee: 450,
      packingFee: 100,
      paidTotal: 1380,
      currencyUnit: 'fen',
      source: 'eleme',
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.items[0]!.unitPrice).toBe(1500)
      expect(result.data.items[0]!.itemDiscount).toBe(0)
      expect(result.data.items[1]!.unitPrice).toBe(200)
      expect(result.data.items[1]!.itemDiscount).toBe(0)
      expect(result.data.orderDiscount).toBe(1070)
      expect(result.data.paidTotal).toBe(1380)
      expect(result.fixKind).toBe('strip_shifu_derived_item_discounts')
    }
  })

  it('does not divide already-correct multi-qty unit prices', () => {
    const result = reconcileOcrBillDraft({
      items: [
        { name: '茉莉奶绿', unitPrice: 1200, quantity: 2, itemDiscount: 0 },
        { name: '奶冻', unitPrice: 200, quantity: 2, itemDiscount: 0 },
      ],
      orderDiscount: 1400,
      deliveryFee: 380,
      packingFee: 200,
      paidTotal: 1980,
      currencyUnit: 'fen',
      source: 'meituan',
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.items[0]!.unitPrice).toBe(1200)
      expect(result.data.items[1]!.unitPrice).toBe(200)
      expect(result.fixKind).toBe('already_balanced')
    }
  })
})
