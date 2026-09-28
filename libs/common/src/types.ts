export interface ServiceEnvelope<T> {
  data: T;
  service: string;
  instance: string;
}

export interface UserIdentityInfo {
  provider: string;
  identifier: string;
  unionid: string | null;
  appCode: string | null;
}

export interface User {
  id: string;
  username: string | null;
  nickname: string;
  phone: string | null;
  email: string | null;
  avatar: string | null;
  status: number;
  appCodes?: string[];
  providers?: string[];
  identities?: UserIdentityInfo[];
  roles?: string[];
  permissions?: string[];
  /** 当前 token 所属微信小程序 appId，仅微信登录会话 */
  wechatAppId?: string;
}

export interface Order {
  id: string;
  userId: string;
  item: string;
  amount: number;
}

export interface CreateUserDto {
  username: string;
  password: string;
  nickname?: string;
  phone?: string;
  email?: string;
  roleCodes?: string[];
}

export interface CreateOrderDto {
  userId: string;
  item: string;
  amount: number;
}

export interface PageQuery {
  page?: number;
  pageSize?: number;
  keyword?: string;
  appCode?: string;
}

export interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AuthSession {
  token: string;
  refreshToken?: string;
  userId: string;
  /** 用户中心接入端 appCode */
  appId: string;
  /** 微信小程序 appId；仅微信登录会话存在，用来区分属于哪一套小程序 */
  wechatAppId?: string;
  username: string | null;
  nickname: string;
  role: 'user' | 'admin';
  roles: string[];
  permissions: string[];
}

export interface AuthResult {
  token: string;
  expiresIn: number;
  refreshToken: string;
  refreshExpiresIn: number;
  user: User;
  wechatAppId?: string;
}

export interface RefreshTokenDto {
  refreshToken: string;
}

export interface RegisterDto {
  username: string;
  password: string;
  nickname?: string;
  phone?: string;
  email?: string;
  appCode?: string;
}

export interface LoginDto {
  username: string;
  password: string;
  appCode?: string;
}

export interface WechatLoginDto {
  appCode: string;
  code: string;
  nickname?: string;
  avatar?: string;
  phone?: string;
}

export interface AlipayLoginDto {
  appCode: string;
  code: string;
  nickname?: string;
  avatar?: string;
  phone?: string;
}

export interface BindPhoneDto {
  phone: string;
}

export interface ClientInfo {
  id: string;
  appCode: string;
  name: string;
  type: 'web' | 'wechat_mp' | 'alipay_mp' | 'app';
  wechatAppId: string | null;
  hasWechatSecret: boolean;
  alipayAppId: string | null;
  hasAlipayPrivateKey: boolean;
  status: number;
}

export interface RoleInfo {
  id: string;
  code: string;
  name: string;
  description: string | null;
  permissionIds: string[];
  permissionCodes: string[];
}

export interface PermissionInfo {
  id: string;
  module: string;
  code: string;
  name: string;
  description: string | null;
  sort: number;
}

export interface WechatMiniProgram {
  id: string;
  code: string;
  name: string;
  appId: string;
  hasSecret: boolean;
  status: number;
}

export interface WechatSession {
  openid: string;
  unionid?: string;
  sessionKey?: string;
  appId: string;
}

export const PERMISSIONS = {
  USER_QUERY: 'user.query',
  USER_CREATE: 'user.create',
  USER_UPDATE: 'user.update',
  USER_ASSIGN_ROLE: 'user.assignRole',
  CLIENT_MANAGE: 'client.manage',
  ROLE_MANAGE: 'role.manage',
  PERMISSION_MANAGE: 'permission.manage',
  PERMISSION_IMPORT: 'permission.import',
  PERMISSION_EXPORT: 'permission.export',
  WECHAT_MANAGE: 'wechat.manage',
  WECHAT_QRCODE: 'wechat.qrcode',
} as const;
