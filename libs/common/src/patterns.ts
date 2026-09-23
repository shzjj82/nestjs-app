export const USER_CLIENT = 'USER_CLIENT';
export const ORDER_CLIENT = 'ORDER_CLIENT';

export const MQTT_GROUPS = {
  USERCENTER: 'usercenter',
  ORDER: 'order',
} as const;

export const MQTT_PATTERNS = {
  USER_HEALTH: 'user.health',
  USER_FIND_ALL: 'user.findAll',
  USER_FIND_ONE: 'user.findOne',
  USER_CREATE: 'user.create',
  ORDER_HEALTH: 'order.health',
  ORDER_FIND_ALL: 'order.findAll',
  ORDER_FIND_ONE: 'order.findOne',
  ORDER_CREATE: 'order.create',
} as const;

export function sharePattern(group: string, pattern: string): string {
  return `$share/${group}/${pattern}`;
}
