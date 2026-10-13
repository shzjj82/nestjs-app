export const UNLINKED = '__none__';

/** 单个场景的订阅消息配置，与后端 `WechatSubscribeTemplate` 契约一致 */
export interface WechatSubscribeTemplate {
  templateId: string;
  /** 微信模板字段名（thing1 / amount3 …） → 业务语义字段名 */
  fields?: Record<string, string>;
}

export interface RegisteredWechatApp {
  id: string;
  code: string;
  name: string;
  appId: string;
  hasSecret: boolean;
  status: number;
  subscribeTemplates: Record<string, WechatSubscribeTemplate>;
}

/**
 * 回收业务订阅消息场景（控制台「快捷添加」+ 新建后预填）。
 *
 * 点开消息会进入顾客订单详情（后端 page =
 * `pages/order-detail/index?id=…&scope=mine`）。
 *
 * 微信公众平台申请模板时，可按「建议关键词」搜索类目模板；字段名以你选中的
 * 模板为准，选完后把微信后台的字段编号改到下面 fields 的 key 上即可。
 */
export const SUGGESTED_SUBSCRIBE_SCENES: {
  scene: string;
  label: string;
  /** 公众平台搜模板用的关键词提示 */
  keywordHint: string;
  /** 推荐标题（便于运营对照） */
  titleHint: string;
  fields: Record<string, string>;
}[] = [
  {
    scene: 'PRICE_OFFERED',
    label: '验收报价完成',
    keywordHint: '订单状态 / 报价结果',
    titleHint: '您的回收单已完成验收报价，请打开确认',
    // 默认只预填常用 3 项，减少编辑弹层 DOM；需要时可再展开加字段
    fields: {
      character_string1: 'orderCode',
      phrase2: 'statusLabel',
      amount3: 'amount',
    },
  },
  {
    scene: 'NEGOTIATE_RESULT',
    label: '协商定价结果',
    keywordHint: '订单状态 / 审核结果',
    titleHint: '协商结果已出，请打开查看',
    fields: {
      character_string1: 'orderCode',
      phrase2: 'statusLabel',
      amount3: 'amount',
    },
  },
  {
    scene: 'PAID',
    label: '回收款已到账',
    keywordHint: '到账提醒 / 收款成功',
    titleHint: '回收款已到账，可打开订单查看',
    fields: {
      character_string1: 'orderCode',
      amount2: 'amount',
      phrase3: 'statusLabel',
    },
  },
  {
    scene: 'RETURN',
    label: '退货完成',
    keywordHint: '订单状态 / 退货完成',
    titleHint: '退货已完成，请打开查看',
    fields: {
      character_string1: 'orderCode',
      phrase2: 'statusLabel',
      thing3: 'title',
    },
  },
];

/**
 * 可映射的语义字段名，与后端 `SUBSCRIBE_SEMANTICS` 保持一致：
 * 后端上报订阅消息时只带这几个语义值，映射到别的名字会渲染成空串。
 *
 * - orderCode   订单号
 * - title       动作标题（如「已完成验收评估」）
 * - statusLabel 状态中文（如「已评估」）
 * - amount      金额（元，字符串）
 * - at          时间
 */
export const SUBSCRIBE_SEMANTICS = [
  'orderCode',
  'title',
  'statusLabel',
  'amount',
  'at',
] as const;

export const SUBSCRIBE_SEMANTIC_LABELS: Record<
  (typeof SUBSCRIBE_SEMANTICS)[number],
  string
> = {
  orderCode: '订单号',
  title: '标题/说明',
  statusLabel: '订单状态',
  amount: '金额(元)',
  at: '时间',
};

/** 编辑器里的一行场景配置；字段映射拆成数组才能稳定地编辑中间项 */
export interface SubscribeTemplateRow {
  scene: string;
  templateId: string;
  fields: { field: string; semantic: string }[];
}

export function emptyTemplateRow(
  scene = '',
  templateId = '',
  fields: Record<string, string> = {},
): SubscribeTemplateRow {
  return {
    scene,
    templateId,
    fields: Object.entries(fields).map(([field, semantic]) => ({ field, semantic })),
  };
}

/** 新建小程序后预填的回收业务四场景（模板 ID 待粘贴） */
export function suggestedSubscribeTemplateRows(): SubscribeTemplateRow[] {
  return SUGGESTED_SUBSCRIBE_SCENES.map((item) =>
    emptyTemplateRow(item.scene, '', item.fields),
  );
}

/** 后端配置 → 编辑器行 */
export function toTemplateRows(
  config: Record<string, WechatSubscribeTemplate> | null | undefined,
): SubscribeTemplateRow[] {
  return Object.entries(config ?? {}).map(([scene, item]) =>
    emptyTemplateRow(scene, item.templateId ?? '', item.fields ?? {}),
  );
}

/**
 * 编辑器行 → 后端配置。
 * 整行/整对都没填的会被丢弃，方便用户留空行；填了一半则报错，
 * 避免「以为配上了、其实没配」。
 */
export function collectTemplates(rows: SubscribeTemplateRow[]): {
  value: Record<string, WechatSubscribeTemplate>;
  error?: string;
} {
  const value: Record<string, WechatSubscribeTemplate> = {};
  for (const row of rows) {
    const scene = row.scene.trim();
    const templateId = row.templateId.trim();
    if (!scene && !templateId) continue;
    if (!scene) return { value, error: '有模板行缺少场景名' };
    if (!templateId) return { value, error: `场景 ${scene} 缺少模板 ID` };
    if (value[scene]) return { value, error: `场景 ${scene} 重复` };
    const fields: Record<string, string> = {};
    for (const pair of row.fields) {
      const field = pair.field.trim();
      const semantic = pair.semantic.trim();
      if (!field && !semantic) continue;
      if (!field || !semantic) {
        return { value, error: `场景 ${scene} 的字段映射没填完整` };
      }
      fields[field] = semantic;
    }
    value[scene] = Object.keys(fields).length
      ? { templateId, fields }
      : { templateId };
  }
  return { value };
}


export interface BusinessAppClient {
  id: string;
  appCode: string;
  businessId: string | null;
  businessCode: string | null;
  name: string;
  type: string;
  wechatAppId: string | null;
  alipayAppId: string | null;
  status: number;
}

export function matchWechatApp(
  apps: RegisteredWechatApp[],
  wechatAppId: string | null,
): RegisteredWechatApp | undefined {
  if (!wechatAppId) return undefined;
  return apps.find((app) => app.appId === wechatAppId || app.code === wechatAppId);
}
