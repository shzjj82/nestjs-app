import {
  MQTT_GROUPS,
  optionalString,
  rpcFail,
  sharePattern,
} from '@app/common';

export { optionalString, requiredString, rpcFail } from '@app/common';

export function ucPattern(pattern: string): string {
  return sharePattern(MQTT_GROUPS.USERCENTER, pattern);
}

export function systemCodeOf(
  payload: Record<string, unknown>,
  required = false,
): string | undefined {
  const code = optionalString(payload.systemCode) ?? optionalString(payload.appId);
  if (required && !code) {
    rpcFail(400, 'systemCode 必填');
  }
  return code;
}

export function clientCodeOf(
  payload: Record<string, unknown>,
  required?: false,
): string | undefined;
export function clientCodeOf(
  payload: Record<string, unknown>,
  required: true,
): string;
export function clientCodeOf(
  payload: Record<string, unknown>,
  required = false,
): string | undefined {
  // 只认 clientCode（HTTP 契约）/ appCode（MQTT 直连时的旧名）。
  // **绝不能回落到 appId**：网关会把调用方的 appId 注入 payload，一旦回落，
  // 「忘了传 code」就会静默变成「用调用方自己的 code 建一个接入端」——
  // 数据被悄悄写错，比报 400 难查得多。
  const code =
    optionalString(payload.clientCode) ?? optionalString(payload.appCode);
  if (required && !code) {
    // 走网关时 body 里的 appCode 会被剥掉（身份只能由网关注入 _appCode），
    // 所以对外契约里的字段名是 clientCode，见 ClientsService.create 的注释。
    rpcFail(400, 'clientCode 必填');
  }
  return code;
}

export function toPage(page?: unknown, pageSize?: unknown) {
  const current = Math.max(1, Number(page) || 1);
  const size = Math.min(100, Math.max(1, Number(pageSize) || 20));
  return { page: current, pageSize: size, skip: (current - 1) * size };
}
