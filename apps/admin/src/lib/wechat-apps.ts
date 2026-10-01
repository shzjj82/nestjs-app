export const UNLINKED = '__none__';

export interface RegisteredWechatApp {
  id: string;
  code: string;
  name: string;
  appId: string;
  hasSecret: boolean;
  status: number;
}

export interface BusinessAppClient {
  id: string;
  appCode: string;
  businessId: string | null;
  businessCode: string | null;
  name: string;
  type: string;
  wechatAppId: string | null;
  alipayAppId: string | null;
  status: number;
}

export function matchWechatApp(
  apps: RegisteredWechatApp[],
  wechatAppId: string | null,
): RegisteredWechatApp | undefined {
  if (!wechatAppId) return undefined;
  return apps.find((app) => app.appId === wechatAppId || app.code === wechatAppId);
}
