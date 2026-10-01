export interface ServiceEnvelope<T> {
  data: T;
  service: string;
  instance: string;
}

export type AccountType = 'password' | 'wechat_mp' | 'alipay_mp';

export interface UserAccountInfo {
  id: string;
  type: AccountType;
  identifier: string;
  status: number;
  roles: string[];
  roleIds: string[];
  roleNames: string[];
  lastLoginAt: string | null;
  createdAt: string;
}

export interface User {
  id: string;
  /** 账密账户的登录名；无账密账户时为 null */
  username: string | null;
  nickname: string;
  phone: string | null;
  email: string | null;
  avatar: string | null;
  status: number;
  createdAt?: string;
  accounts?: UserAccountInfo[];
  /** 当前会话账户（仅 /auth/me 与登录结果） */
  accountId?: string;
  roles?: string[];
  permissions?: string[];
  /** 当前 token 所属微信小程序 appId，仅微信登录会话 */
  wechatAppId?: string;
  /** 当前会话所属业务 code */
  bizCode?: string;
}

export interface Order {
  id: string;
  accountId: string | null;
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
  item?: string;
  amount?: number;
}

export interface PageQuery {
  page?: number;
  pageSize?: number;
  keyword?: string;
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
  /** 登录所用账户；角色与权限来自该账户 */
  accountId?: string;
  /** 用户中心接入端 appCode */
  appId: string;
  /** 会话所属业务 code；角色与权限只在该业务内有效 */
  bizCode: string;
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

export type TeamRole = 'owner' | 'developer' | 'user';

export interface TeamInfo {
  id: string;
  appCode: string;
  bizCode: string;
  /** 加入团队用，创建时生成，拥有者可刷新 */
  code: string;
  name: string;
  description: string | null;
  role: TeamRole;
  createdAt: string;
  updatedAt: string;
}

export interface TeamMemberInfo {
  id: string;
  accountId: string;
  accountType: string;
  identifier: string;
  role: TeamRole;
  createdAt: string;
  updatedAt: string;
}

export interface ClientInfo {
  id: string;
  appCode: string;
  businessId: string | null;
  businessCode: string | null;
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
  /** 为空表示平台级角色 */
  businessId: string | null;
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

/** 系统保留业务：admin 控制台会话，平台管理接口只接受该业务；业务接口全部放行 */
export const PLATFORM_BIZ_CODE = 'platform';

export interface BusinessRegistryEntry {
  code: string;
  status: number;
  /** 已开通的业务接口，见 routeKey() */
  apis: string[];
}

export interface BusinessInfo {
  id: string;
  code: string;
  name: string;
  description: string | null;
  status: number;
  apis: string[];
  defaultRoleId: string | null;
  isSystem: boolean;
  permissionIds: string[];
  memberCount: number;
  createdAt: string;
}

export interface BusinessMemberInfo {
  id: string;
  businessId: string;
  userId: string;
  nickname: string;
  username: string | null;
  phone: string | null;
  status: number;
  roleIds: string[];
  roleNames: string[];
  createdAt: string;
}

export const PERMISSIONS = {
  BUSINESS_MANAGE: 'business.manage',
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

export type AgentChatRole = 'user' | 'assistant';

export type AgentChatAttachment =
  | { kind: 'image'; name: string; url: string }
  | { kind: 'text'; name: string; text: string };

export interface AgentChatInput {
  messages: Array<{ role: AgentChatRole; content: string }>;
  attachments?: AgentChatAttachment[];
  system?: string;
  /** true（默认）一次返回完整 reply；false 上游 stream，网关 SSE 转给前端 */
  sync?: boolean;
}

export interface AgentChatResult {
  reply: string;
}

export type AgentChatStreamEvent =
  | { delta: string }
  | { reply: string }
  | { error: string };
