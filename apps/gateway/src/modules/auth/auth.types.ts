export interface GatewayUser {
  id: string;
  accountId?: string;
  name: string;
  role: 'user' | 'admin';
  appId: string;
  bizCode?: string;
  wechatAppId?: string;
  /** 微信小程序 openid；仅 wechat_mp 登录会话有，下游收款/订阅消息依赖它 */
  openid?: string;
  username?: string | null;
  roles: string[];
  permissions: string[];
  token: string;
}
