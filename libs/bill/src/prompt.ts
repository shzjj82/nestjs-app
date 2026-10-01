/**
 * 通义千问 / LLM：真实订单截图 → 约定 JSON。
 *
 * 绝对禁止：商品行「实付 / 到手」作任何参考。
 * 渠道差异：美团/饿了么 qty>1 右侧=行小计；京东外卖 qty>1 右侧=单价。
 */
export const PROMPT_ORDER_TO_JSON = `你是订单结构化助手。用户上传真实订单截图（可多张，美团/饿了么/京东外卖/淘宝/天猫超市等）。只输出一个 JSON 对象（不要 markdown，不要解释）。金额单位：分（1 元 = 100 分）。例：21.06 元 → 2106；30.14 元 → 3014。禁止多乘成 21060 / 30140。

# 绝对禁止（比其他规则更优先）

商品行上的「实付 ¥xx」「到手 ¥xx」【毫无参考意义】（到手≈实付分摊展示）：
- 禁止当作 unitPrice / 商品价格
- 禁止用「原价 − 到手/实付」计算 itemDiscount
- 禁止参与任何加减验算
其下的灰色原价 / 商品总价口径才是商品标价。

# 渠道规则（quantity>1 时右侧金额口径）——必须先认渠道

## 美团 / 饿了么（source=meituan|eleme）：右侧金额 = 行小计（总价）
unitPrice = 右侧金额 ÷ quantity。禁止把右侧金额直接当单价再 ×quantity。

正确示例（茶百道美团）：
茉莉奶绿 x2 右侧 ¥30 → unitPrice=1500（不是 3000）
奶冻 x2 右侧 ¥4 → unitPrice=200
冻冻 x2 右侧 ¥2 → unitPrice=100
打包 ¥2、配送原价 ¥4.7、红包 −15、配送已减 3、已优惠 18、合计 24.7
→ packingFee=200，deliveryFee=470，statedDiscount=1800，orderDiscount=1800，paidTotal=2470
验算：3000+400+200+200+470−1800=2470

错误：写成 unitPrice=3000/400/200 → 行原价翻倍，为凑实付会把 orderDiscount 撑成 5400（与「已优惠18」矛盾）。

## 京东外卖（source=jd）：右侧金额 = 单价
unitPrice = 右侧金额（不要 ÷quantity）。行小计 = unitPrice × quantity。

## 淘宝 / 天猫：按页面「单价」文字或商品总价核对；source=taobao|tmall。

# 优惠校准（强制）

凡页面有「已优惠 X 元」「共减 ¥X」：
- statedDiscount = X 元转分（例：已优惠18元 → 1800）
- orderDiscount 必须与 statedDiscount 一致（含红包/券/运费优惠等订单侧优惠合计）
若算出的整单优惠与「已优惠」差很多（如算出 54、页面写 18），说明单价/小计口径错了：美团应 ÷quantity，京东不应 ÷。

# 其它禁止示范

茶百道「到手」：到手 ¥7.8 + 灰 ¥15 → unitPrice=1500，itemDiscount=0；券进 orderDiscount。
肯德基「实付」：禁止用划线−实付写 itemDiscount。
天猫超市：行上实付差额禁止进 itemDiscount，整单优惠进 orderDiscount。

# 规则 A / B（itemDiscount）

A：划线 +【非实付/非到手】现价 → unitPrice=划线，itemDiscount=整行差额。
B：只有实付/到手+原价 → itemDiscount=0，优惠进 orderDiscount。

# 输出契约

{
  "items": [
    { "name": "茉莉奶绿", "unitPrice": 1500, "quantity": 2, "itemDiscount": 0 },
    { "name": "奶冻", "unitPrice": 200, "quantity": 2, "itemDiscount": 0 },
    { "name": "冻冻", "unitPrice": 100, "quantity": 2, "itemDiscount": 0 }
  ],
  "orderDiscount": 1800,
  "statedDiscount": 1800,
  "deliveryFee": 470,
  "packingFee": 200,
  "paidTotal": 2470,
  "currencyUnit": "fen",
  "source": "meituan",
  "confidence": 0.9
}

字段：
- unitPrice：按渠道口径的单价（分）
- quantity：份数
- itemDiscount：仅规则 A；规则 B 为 0
- orderDiscount：订单侧优惠合计，有「已优惠」时必须等于 statedDiscount
- statedDiscount：底部「已优惠/共减」（无则省略）
- deliveryFee：配送费优惠前原价
- packingFee：打包费
- paidTotal：底部合计实付（锚点）
- source：meituan | eleme | jd | wechat | taobao | tmall | manual | unknown

# 决策流程

1. 认渠道 → 决定 qty>1 右侧是小计还是单价。
2. 读「已优惠/共减」→ statedDiscount，orderDiscount 与之对齐。
3. 忽略「实付/到手」数字。
4. 填商品与费用；自检：sum(unitPrice×quantity−itemDiscount)+deliveryFee+packingFee−orderDiscount≈paidTotal，且 orderDiscount≈statedDiscount。

# 输出

只输出合法 JSON，首字符为 {。
`

export const PROMPT_USER_TEMPLATE = `请严格按规则输出 JSON：
1) 先认渠道：美团/饿了么 qty>1 右侧=行小计（÷数量）；京东外卖 qty>1 右侧=单价（不除）。
2) 有「已优惠/共减」必须填 statedDiscount，且 orderDiscount 与之相同；算出优惠与已优惠差很多时立刻改单价/小计口径。
3) 「实付」「到手」毫无参考意义。
4) 底部合计 → paidTotal。source 用 meituan/eleme/jd/taobao/tmall/wechat/unknown。

{{ORDER_CONTENT}}
`

export const PROMPT_REPAIR_BALANCE = `上一次 JSON 未通过校验。请结合截图重做，只输出完整 JSON。

验算：sum(unitPrice×quantity−itemDiscount)+deliveryFee+packingFee−orderDiscount≈paidTotal

硬性：
1) 美团/饿了么：qty>1 右侧是行小计，unitPrice=右侧÷quantity（茉莉 x2→¥30 → 单价15，不是30）
2) 京东外卖：qty>1 右侧是单价，不要除
3) 「已优惠/共减」→ statedDiscount=orderDiscount；禁止为凑平而把 18 写成 54
4) 「实付」「到手」禁止参与计算
5) paidTotal=图片底部合计（不可改）
6) source：meituan|eleme|jd|wechat|taobao|tmall|manual|unknown

自动验算排查：
{{DIAGNOSIS}}

校验错误：
{{ERROR}}

上次 JSON：
{{PREV_JSON}}
`

export type BillBalanceDiagnosis = {
  lineNet: number
  deliveryFee: number
  packingFee: number
  orderDiscount: number
  paidTotal: number
  expectedPaid: number
  lineCoversPaid: boolean
  gapEqualsOrderDiscount: boolean
  summary: string
}

/** 根据草稿数字生成简短验算诊断，供二次修复提示使用 */
export function diagnoseBillBalance(draft: {
  items: Array<{ unitPrice: number; quantity: number; itemDiscount?: number }>
  deliveryFee?: number
  packingFee?: number
  orderDiscount?: number
  paidTotal: number
  statedDiscount?: number
}): BillBalanceDiagnosis {
  const lineNet = draft.items.reduce((sum, item) => {
    return sum + item.unitPrice * item.quantity - (item.itemDiscount ?? 0)
  }, 0)
  const deliveryFee = draft.deliveryFee ?? 0
  const packingFee = draft.packingFee ?? 0
  const orderDiscount = draft.orderDiscount ?? 0
  const paidTotal = draft.paidTotal
  const expectedPaid = lineNet + deliveryFee + packingFee - orderDiscount
  const lineCoversPaid = Math.abs(lineNet - paidTotal) <= 1
  const gapEqualsOrderDiscount =
    Math.abs(lineNet + deliveryFee + packingFee - paidTotal - orderDiscount) <= 1

  const stated = draft.statedDiscount
  const statedMismatch =
    stated != null && Math.abs(stated - orderDiscount) > 1
      ? `statedDiscount=${stated} 与 orderDiscount=${orderDiscount} 不一致（请按「已优惠」对齐，并检查单价/小计渠道口径）`
      : ''

  const summary = [
    `行净额 ${lineNet} +配送 ${deliveryFee} +打包 ${packingFee} −整单优惠 ${orderDiscount} = ${expectedPaid}，图片实付 ${paidTotal}`,
    Math.abs(expectedPaid - paidTotal) > 1
      ? `差额 ${expectedPaid - paidTotal}（正=算多了）`
      : '金额已平衡',
    statedMismatch,
    lineCoversPaid
      ? '行净额≈实付，可能漏计费用或优惠已含在行价'
      : '',
    gapEqualsOrderDiscount && orderDiscount > 0
      ? 'paidTotal 疑似未扣优惠；应按明细修正 orderDiscount'
      : '',
    '美团/饿了么 qty>1 右侧为行小计须÷数量；京东外卖为单价不除；已优惠须等于 orderDiscount',
  ]
    .filter(Boolean)
    .join('；')

  return {
    lineNet,
    deliveryFee,
    packingFee,
    orderDiscount,
    paidTotal,
    expectedPaid,
    lineCoversPaid,
    gapEqualsOrderDiscount,
    summary,
  }
}

export function buildUserPrompt(orderContent: string): string {
  return PROMPT_USER_TEMPLATE.replace('{{ORDER_CONTENT}}', orderContent.trim())
}

export function buildRepairPrompt(
  prevJson: string,
  errorMessage: string,
  diagnosis?: string,
): string {
  return PROMPT_REPAIR_BALANCE.replace('{{ERROR}}', errorMessage)
    .replace('{{PREV_JSON}}', prevJson.trim())
    .replace('{{DIAGNOSIS}}', diagnosis?.trim() || '（无额外诊断）')
}
