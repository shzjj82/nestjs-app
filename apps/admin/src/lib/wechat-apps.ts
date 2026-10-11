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
 * 回收业务上报的订阅消息场景，仅作为控制台的「快捷添加」建议。
 *
 * 场景名由业务侧定义（后端 wechat 服务不认识回收），这里只是替人手输，
 * 所以**不作为校验**：填别的场景名后端一样接受。
 */
export const SUGGESTED_SUBSCRIBE_SCENES: {
  scene: string;
  label: string;
  fields: Record<string, string>;
}[] = [
  {
    scene: 'PRICE_OFFERED',
    label: '验收报价完成',
    fields: { thing1: 'orderCode', amount2: 'amount', thing3: 'statusLabel' },
  },
  {
    scene: 'NEGOTIATE_RESULT',
    label: '协商定价结果',
    fields: { thing1: 'orderCode', amount2: 'amount', thing3: 'statusLabel' },
  },
  {
    scene: 'PAID',
    label: '回收款已到账',
    fields: { thing1: 'orderCode', amount2: 'amount', thing3: 'statusLabel' },
  },
  {
    scene: 'RETURN',
    label: '退货完成',
    fields: { thing1: 'orderCode', thing2: 'statusLabel' },
  },
];

/**
 * 可映射的语义字段名，与后端 `SUBSCRIBE_SEMANTICS` 保持一致：
 * 后端上报订阅消息时只带这几个语义值，映射到别的名字会渲染成空串。
 */
export const SUBSCRIBE_SEMANTICS = [
  'orderCode',
  'title',
  'statusLabel',
  'amount',
  'at',
] as const;

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
