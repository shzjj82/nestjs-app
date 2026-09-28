export const USER_CLIENT = 'USER_CLIENT';
export const ORDER_CLIENT = 'ORDER_CLIENT';
export const DOCS_CLIENT = 'DOCS_CLIENT';
export const UPLOAD_CLIENT = 'UPLOAD_CLIENT';
export const WECHAT_CLIENT = 'WECHAT_CLIENT';

export const MQTT_GROUPS = {
  USERCENTER: 'usercenter',
  ORDER: 'order',
  DOCS: 'docs',
  UPLOAD: 'upload',
  WECHAT: 'wechat',
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
  DOC_HEALTH: 'doc.health',
  DOC_POST_FIND_ALL: 'doc.post.findAll',
  DOC_POST_FIND_SLUG: 'doc.post.findSlug',
  DOC_POST_FIND_ID: 'doc.post.findId',
  DOC_POST_CREATE: 'doc.post.create',
  DOC_POST_UPDATE: 'doc.post.update',
  DOC_POST_DELETE: 'doc.post.delete',
  DOC_POST_CHILDREN: 'doc.post.children',
  DOC_POST_REPARENT: 'doc.post.reparent',
  DOC_CATEGORY_FIND_ALL: 'doc.category.findAll',
  DOC_CATEGORY_FIND_SLUG: 'doc.category.findSlug',
  DOC_CATEGORY_CREATE: 'doc.category.create',
  DOC_CATEGORY_UPDATE: 'doc.category.update',
  DOC_CATEGORY_DELETE: 'doc.category.delete',
  UPLOAD_HEALTH: 'upload.health',
  UPLOAD_PUT: 'upload.put',
  UPLOAD_ENQUEUE: 'upload.enqueue',
  UPLOAD_JOB: 'upload.job',
  UPLOAD_DELETE: 'upload.delete',
  WECHAT_HEALTH: 'wechat.health',
  WECHAT_MP_FIND_ALL: 'wechat.mp.findAll',
  WECHAT_MP_CREATE: 'wechat.mp.create',
  WECHAT_MP_UPDATE: 'wechat.mp.update',
  WECHAT_CODE2SESSION: 'wechat.code2session',
  WECHAT_QRCODE: 'wechat.qrcode',
  WECHAT_PHONE: 'wechat.phone',
} as const;

export function sharePattern(group: string, pattern: string): string {
  return `$share/${group}/${pattern}`;
}
