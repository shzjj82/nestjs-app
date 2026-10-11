import { SUBSCRIBE_SEMANTICS } from '@app/common';
import type { WechatSubscribeTemplate } from '@app/common';
import { optionalString, rpcFail } from '../common/rpc';

/** 场景名：业务自定义，但必须能安全地当 JSON key 与日志字段 */
const SCENE_RE = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/;
/** 微信模板字段名，如 thing1 / character_string2 / amount3 */
const TEMPLATE_FIELD_RE = /^[a-z][a-z0-9_]{0,31}$/;

/**
 * 校验并规范化订阅消息配置。
 *
 * 故意做成不依赖 Nest / TypeORM 的纯函数：这段逻辑是配置正确性的唯一防线，
 * 必须能脱离容器与数据库单独跑测试。
 *
 * 场景名由业务侧定义（wechat 服务不认识回收/订单），这里只做「能不能安全使用」的
 * 格式校验；但字段映射的**取值**必须落在 `SUBSCRIBE_SEMANTICS` 里 ——
 * 语义名拼错时微信不报错、只是渲染成空串，属于最难查的一类线上问题。
 */
export function normalizeSubscribeTemplates(
  value: unknown,
): Record<string, WechatSubscribeTemplate> {
  if (value === undefined || value === null) {
    return {};
  }
  if (typeof value !== 'object' || Array.isArray(value)) {
    rpcFail(400, 'subscribeTemplates 需为「场景 → { templateId, fields }」对象');
  }
  const out: Record<string, WechatSubscribeTemplate> = {};
  for (const [scene, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!SCENE_RE.test(scene)) {
      rpcFail(
        400,
        `订阅消息场景名 ${scene} 非法：字母或数字开头，仅含字母数字._-，不超 64 字符`,
      );
    }
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      rpcFail(400, `场景 ${scene} 的配置需为 { templateId, fields? }`);
    }
    const { templateId, fields } = raw as Record<string, unknown>;
    const id = optionalString(templateId);
    if (!id) {
      rpcFail(400, `场景 ${scene} 缺 templateId；要停发该场景请直接删除这个场景`);
    }
    if (id.length > 128) {
      rpcFail(400, `场景 ${scene} 的 templateId 过长（最多 128 字符）`);
    }
    const mapped = normalizeFields(scene, fields);
    out[scene] = mapped ? { templateId: id, fields: mapped } : { templateId: id };
  }
  return out;
}

function normalizeFields(
  scene: string,
  value: unknown,
): Record<string, string> | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== 'object' || Array.isArray(value)) {
    rpcFail(400, `场景 ${scene} 的 fields 需为「模板字段 → 语义字段」对象`);
  }
  const out: Record<string, string> = {};
  for (const [field, semantic] of Object.entries(
    value as Record<string, unknown>,
  )) {
    if (!TEMPLATE_FIELD_RE.test(field)) {
      rpcFail(
        400,
        `场景 ${scene} 的模板字段名 ${field} 非法（如 thing1、character_string2）`,
      );
    }
    const name = optionalString(semantic);
    if (!name || !(SUBSCRIBE_SEMANTICS as readonly string[]).includes(name)) {
      rpcFail(
        400,
        `场景 ${scene} 的 ${field} 映射到未知语义 ${String(semantic)}；` +
          `可用：${SUBSCRIBE_SEMANTICS.join(' / ')}`,
      );
    }
    out[field] = name;
  }
  return Object.keys(out).length ? out : undefined;
}
