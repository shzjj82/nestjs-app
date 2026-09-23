export interface GatewayUser {
  id: string;
  name: string;
  role: 'user' | 'admin';
  appId: string;
  username?: string | null;
  roles: string[];
  permissions: string[];
  token: string;
}
