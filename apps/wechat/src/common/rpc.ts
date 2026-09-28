import { MQTT_GROUPS, sharePattern } from '@app/common';

export { optionalString, requiredString, rpcFail } from '@app/common';

export function wechatPattern(pattern: string): string {
  return sharePattern(MQTT_GROUPS.WECHAT, pattern);
}
