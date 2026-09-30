export interface GatewayUser {
  id: string;
  accountId?: string;
  name: string;
  role: 'user' | 'admin';
  appId: string;
  bizCode?: string;
  wechatAppId?: string;
  username?: string | null;
  roles: string[];
  permissions: string[];
  token: string;
}
