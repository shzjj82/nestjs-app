export interface ServiceEnvelope<T> {
  data: T;
  service: string;
  instance: string;
}

export interface User {
  id: string;
  username: string | null;
  nickname: string;
  phone: string | null;
  email: string | null;
  avatar: string | null;
  status: number;
  appIds: string[];
  roles?: string[];
  permissions?: string[];
}

export interface Order {
  id: string;
  userId: string;
  item: string;
  amount: number;
}

export interface CreateUserDto {
  appId: string;
  username: string;
  password: string;
  nickname?: string;
  phone?: string;
  email?: string;
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
  appId?: string;
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
  appId: string;
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
}

export interface RefreshTokenDto {
  refreshToken: string;
}

export interface RegisterDto {
  appId: string;
  username: string;
  password: string;
  nickname?: string;
  phone?: string;
  email?: string;
}

export interface LoginDto {
  appId: string;
  username: string;
  password: string;
}

export interface WechatLoginDto {
  appId: string;
  code: string;
  nickname?: string;
  avatar?: string;
}

export interface AppInfo {
  id: string;
  appId: string;
  name: string;
  type: 'web' | 'miniprogram' | 'app';
  wechatAppId: string | null;
  status: number;
}

export interface RoleInfo {
  id: string;
  appId: string;
  code: string;
  name: string;
  description: string | null;
  permissionIds: string[];
  permissionCodes: string[];
}

export interface PermissionInfo {
  id: string;
  appId: string;
  module: string;
  code: string;
  name: string;
  description: string | null;
  sort: number;
}

export const PERMISSIONS = {
  USER_QUERY: 'user.query',
  USER_CREATE: 'user.create',
  USER_UPDATE: 'user.update',
  USER_BIND_APP: 'user.bindApp',
  USER_ASSIGN_ROLE: 'user.assignRole',
  APP_MANAGE: 'app.manage',
  ROLE_MANAGE: 'role.manage',
  PERMISSION_MANAGE: 'permission.manage',
  PERMISSION_IMPORT: 'permission.import',
  PERMISSION_EXPORT: 'permission.export',
} as const;
