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
  /**
   * 微信 openid；仅微信小程序登录会话存在。
   * 由 usercenter 签发会话时从账户记录取（客户端传不进来），
   * 下游服务（如回收）发订阅消息 / 打款都以它为准。
   */
  openid?: string;
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

/** 小程序码用途：bind 绑定关系；login 扫码登录（走 MQTT 推送） */
export type QrPurpose = 'bind' | 'login';

export type LoginQrStatus = 'pending' | 'scanned' | 'confirmed' | 'expired';

export interface LoginQrCreateResult {
  purpose: 'login';
  ticket: string;
  scene: string;
  /** 浏览器可用 SSE；也可直接用 MQTT 订阅该 topic */
  mqttTopic: string;
  /** 网关 SSE：GET /auth/login/qrcode/:ticket/events */
  eventsPath: string;
  expiresIn: number;
  expiresAt: string;
  image: {
    mime: string;
    filename: string;
    /** OSS / 对象存储公网地址，前端直接用作 img src */
    url: string;
    key: string;
  };
}

export interface LoginQrEvent {
  purpose: 'login';
  ticket: string;
  status: LoginQrStatus;
  at: string;
  auth?: AuthResult;
}

export interface LoginQrStatusResult {
  purpose: 'login';
  ticket: string;
  status: LoginQrStatus;
  mqttTopic: string;
  expiresAt: string;
  auth?: AuthResult;
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
  /**
   * platform（角色权限）：在角色页勾选，控制管理后台；
   * business（开通模块）：在业务页开通，控制租户接口白名单。
   */
  scope: 'platform' | 'business';
  module: string;
  code: string;
  name: string;
  description: string | null;
  sort: number;
  /** 绑定的网关接口键，如 `GET /users`；一功能点可对应多个接口 */
  apis: string[];
  /** 仅超级管理员；列表不展示、不可分配给其他角色 */
  adminOnly: boolean;
}

/**
 * 单个场景的订阅消息配置。
 *
 * 微信模板的 data 字段名（thing1 / character_string2 / amount3 …）
 * 是模板申请下来才确定的，业务服务不可能知道。所以这里配一份
 * 「模板字段 → 业务语义字段」的映射：业务服务只上报语义值
 * （orderCode / title / amount …），由 wechat 服务按这份配置填进模板。
 */
export interface WechatSubscribeTemplate {
  /** 小程序后台申请的模板 ID */
  templateId: string;
  /** 模板字段名 → 语义字段名；省略时回落到默认填充（thing1 = title） */
  fields?: Record<string, string>;
}

/**
 * 业务服务上报订阅消息时**必须**使用的语义字段名。
 *
 * 映射值只允许取这里的取值：拼错会让模板字段渲染成空串，而微信接口
 * 依然返回成功（errcode=0），等于静默丢字段。所以宁可在配置期就拒掉。
 */
export const SUBSCRIBE_SEMANTICS = [
  'orderCode',
  'title',
  'statusLabel',
  'amount',
  'at',
] as const;

export type SubscribeSemantic = (typeof SUBSCRIBE_SEMANTICS)[number];

export interface WechatMiniProgram {
  id: string;
  code: string;
  name: string;
  appId: string;
  hasSecret: boolean;
  status: number;
  /**
   * 场景 → 模板配置。业务侧只说「发什么场景」，
   * 模板 ID 与字段映射由这份配置补全，客户端绝不自己编模板 ID。
   * 未配置的场景不下发（空串）也不发送。
   */
  subscribeTemplates: Record<string, WechatSubscribeTemplate>;
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
  USER_QUERY: 'user.query',
  USER_CREATE: 'user.create',
  USER_UPDATE: 'user.update',
  USER_ASSIGN_ROLE: 'user.assignRole',

  BUSINESS_QUERY: 'business.query',
  BUSINESS_MANAGE: 'business.manage',

  CLIENT_QUERY: 'client.query',
  CLIENT_MANAGE: 'client.manage',

  ROLE_QUERY: 'role.query',
  ROLE_MANAGE: 'role.manage',

  PERMISSION_QUERY: 'permission.query',
  PERMISSION_MANAGE: 'permission.manage',
  PERMISSION_IMPORT: 'permission.import',
  PERMISSION_EXPORT: 'permission.export',

  WECHAT_QUERY: 'wechat.query',
  WECHAT_MANAGE: 'wechat.manage',
  WECHAT_QRCODE: 'wechat.qrcode',
} as const;

/** 功能点目录分类展示顺序（含业务模块） */
export const PERMISSION_MODULE_ORDER = [
  '用户中心',
  '业务租户',
  '接入端',
  '角色权限',
  '功能点目录',
  '微信小程序',
  '认证',
  '团队',
  '通用订单',
  '文档',
  '上传',
  '微信业务',
  '回收·基础',
  '回收·目录',
  '回收·门店',
  '回收·订单',
  '回收·审批',
  '智能助手',
] as const;

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
  /** true 时用当前业务下账号可见文档做 RAG 增强；未配 embedding 时忽略 */
  rag?: boolean;
  /** RAG 取回片段数，默认 6 */
  ragTopK?: number;
}

export interface AgentRagSource {
  docId: string;
  title: string;
  slug: string;
  chunkIndex: number;
  content: string;
  score: number;
  sourceType: string;
}

export interface AgentChatResult {
  reply: string;
  /** rag=true 且命中时返回引用片段 */
  sources?: AgentRagSource[];
}

export interface AgentRagSearchInput {
  query: string;
  topK?: number;
  /** 仅搜本人文档；默认 false 按 feed 可见（公开 + 本人 + 团队） */
  mineOnly?: boolean;
}

export interface AgentRagSearchResult {
  items: AgentRagSource[];
}

export type AgentChatStreamEvent =
  | { delta: string }
  | { reply: string }
  | { error: string };
