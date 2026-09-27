import { MQTT_GROUPS, sharePattern } from '@app/common';

export { asRecord, requiredString, rpcFail } from '@app/common';

export function uploadPattern(pattern: string): string {
  return sharePattern(MQTT_GROUPS.UPLOAD, pattern);
}
