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
  USER_UPDATE: 'user.update',
  USER_ASSIGN_ROLES: 'user.assignRoles',
  AUTH_REGISTER: 'auth.register',
  AUTH_LOGIN: 'auth.login',
  AUTH_WECHAT: 'auth.wechat',
  AUTH_ALIPAY: 'auth.alipay',
  AUTH_REFRESH: 'auth.refresh',
  AUTH_LOGOUT: 'auth.logout',
  AUTH_ME: 'auth.me',
  AUTH_BIND_PHONE: 'auth.bindPhone',
  CLIENT_FIND_ALL: 'client.findAll',
  CLIENT_CREATE: 'client.create',
  CLIENT_UPDATE: 'client.update',
  ROLE_FIND_ALL: 'role.findAll',
  ROLE_CREATE: 'role.create',
  ROLE_UPDATE: 'role.update',
  ROLE_DELETE: 'role.delete',
  ROLE_SET_PERMISSIONS: 'role.setPermissions',
  PERMISSION_FIND_ALL: 'permission.findAll',
  PERMISSION_CREATE: 'permission.create',
  PERMISSION_UPDATE: 'permission.update',
  PERMISSION_DELETE: 'permission.delete',
  PERMISSION_EXPORT: 'permission.export',
  PERMISSION_IMPORT: 'permission.import',
  ORDER_HEALTH: 'order.health',
  ORDER_FIND_ALL: 'order.findAll',
  ORDER_FIND_ONE: 'order.findOne',
  ORDER_CREATE: 'order.create',
} as const;

export function sharePattern(group: string, pattern: string): string {
  return `$share/${group}/${pattern}`;
}
