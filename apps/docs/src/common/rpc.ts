import { MQTT_GROUPS, sharePattern } from '@app/common';

export { asRecord, optionalString, requiredString, rpcFail } from '@app/common';

export function docsPattern(pattern: string): string {
  return sharePattern(MQTT_GROUPS.DOCS, pattern);
}
