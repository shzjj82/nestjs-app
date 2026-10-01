import { finalizeOcrBillDraft, validateBillDraft } from './schema'

describe('validateBillDraft', () => {
  it('accepts a balanced bill', () => {
    const result = validateBillDraft({
      items: [
        { name: '宫保鸡丁', unitPrice: 2800, quantity: 1, itemDiscount: 0, assignees: [] },
        { name: '米饭', unitPrice: 200, quantity: 2, itemDiscount: 0, assignees: [] },
      ],
      orderDiscount: 500,
      deliveryFee: 300,
      packingFee: 100,
      paidTotal: 3100,
      currencyUnit: 'fen',
      source: 'meituan',
    })
    // 2800 + 400 + 300 + 100 - 500 = 3100
    expect(result.ok).toBe(true)
  })

  it('rejects unbalanced paidTotal', () => {
    const result = validateBillDraft({
      items: [{ name: '面', unitPrice: 1000, quantity: 1, assignees: [] }],
      orderDiscount: 0,
      deliveryFee: 0,
      packingFee: 0,
      paidTotal: 800,
      currencyUnit: 'fen',
      source: 'manual',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors[0]?.path).toBe('paidTotal')
      expect(result.errors[0]?.message).toContain('¥10.00')
      expect(result.errors[0]?.message).toContain('¥8.00')
      expect(result.errors[0]?.message).not.toContain('分')
    }
  })

  it('rejects empty items', () => {
    const result = validateBillDraft({
      items: [],
      paidTotal: 0,
      currencyUnit: 'fen',
    })
    expect(result.ok).toBe(false)
  })

  it('accepts line prices that already include promo with zero orderDiscount', () => {
    const result = validateBillDraft({
      items: [
        { name: 'A', unitPrice: 1390, quantity: 1 },
        { name: 'B', unitPrice: 1150, quantity: 1 },
        { name: 'C', unitPrice: 1090, quantity: 1 },
        { name: 'D', unitPrice: 1146, quantity: 1 },
      ],
      orderDiscount: 0,
      deliveryFee: 0,
      packingFee: 0,
      paidTotal: 4776,
      currencyUnit: 'fen',
      source: 'meituan',
    })
    expect(result.ok).toBe(true)
  })

  it('accepts taobao/tmall/jd sources and coerces unknown platforms', () => {
    const taobao = validateBillDraft({
      items: [{ name: '牛奶', unitPrice: 1000, quantity: 1 }],
      orderDiscount: 0,
      deliveryFee: 0,
      packingFee: 0,
      paidTotal: 1000,
      currencyUnit: 'fen',
      source: 'taobao',
    })
    expect(taobao.ok).toBe(true)
    if (taobao.ok) expect(taobao.data.source).toBe('taobao')

    const tmall = validateBillDraft({
      items: [{ name: '纸巾', unitPrice: 2000, quantity: 1 }],
      orderDiscount: 0,
      deliveryFee: 0,
      packingFee: 0,
      paidTotal: 2000,
      currencyUnit: 'fen',
      source: '天猫超市',
    })
    expect(tmall.ok).toBe(true)
    if (tmall.ok) expect(tmall.data.source).toBe('tmall')

    const jd = validateBillDraft({
      items: [{ name: '饮料', unitPrice: 800, quantity: 1 }],
      orderDiscount: 0,
      deliveryFee: 0,
      packingFee: 0,
      paidTotal: 800,
      currencyUnit: 'fen',
      source: '京东外卖',
    })
    expect(jd.ok).toBe(true)
    if (jd.ok) expect(jd.data.source).toBe('jd')

    const unknown = validateBillDraft({
      items: [{ name: '其它', unitPrice: 500, quantity: 1 }],
      orderDiscount: 0,
      deliveryFee: 0,
      packingFee: 0,
      paidTotal: 500,
      currencyUnit: 'fen',
      source: 'pinduoduo',
    })
    expect(unknown.ok).toBe(true)
    if (unknown.ok) expect(unknown.data.source).toBe('unknown')
  })

  it('accepts 茶百道到手价订单（用原价不用到手）', () => {
    // 到手 7.8/1.1 忽略；原价 15 + 2×2；运费原价 4.5；打包 1；券9+运费优惠1.7
    const result = validateBillDraft({
      items: [
        { name: '茉莉奶绿', unitPrice: 1500, quantity: 1, itemDiscount: 0 },
        { name: '奶冻', unitPrice: 200, quantity: 2, itemDiscount: 0 },
      ],
      orderDiscount: 1070,
      deliveryFee: 450,
      packingFee: 100,
      paidTotal: 1380,
      currencyUnit: 'fen',
      source: 'eleme',
    })
    expect(result.ok).toBe(true)
  })

  it('finalizeOcrBillDraft keeps paidTotal and adjusts orderDiscount', () => {
    const result = finalizeOcrBillDraft({
      items: [
        { name: '水卫仕', unitPrice: 1390, quantity: 1 },
        { name: '柠檬茶', unitPrice: 1150, quantity: 1 },
        { name: '提拉米苏', unitPrice: 1090, quantity: 1 },
        { name: '日清', unitPrice: 1680, quantity: 1, itemDiscount: 534 },
      ],
      orderDiscount: 0,
      deliveryFee: 0,
      packingFee: 0,
      // 图片整单实付 42.42；行净额 1390+1150+1090+1146=4776 → 整单优惠应为 534
      paidTotal: 4242,
      currencyUnit: 'fen',
      source: 'meituan',
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.paidTotal).toBe(4242)
      expect(result.data.items[3]!.itemDiscount).toBe(534)
      expect(result.data.orderDiscount).toBe(534)
      expect(result.adjusted).toBe(true)
    }
  })
})
