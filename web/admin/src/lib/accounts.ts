import { KeyRound, type LucideIcon, MessageCircle, Wallet } from 'lucide-react';

export type AccountType = 'password' | 'wechat_mp' | 'alipay_mp';

export interface UserAccount {
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

export interface CenterUser {
  id: string;
  username: string | null;
  nickname: string;
  phone: string | null;
  email: string | null;
  avatar: string | null;
  status: number;
  createdAt?: string;
  accounts?: UserAccount[];
}

export const ACCOUNT_TYPE_META: Record<AccountType, { label: string; icon: LucideIcon }> = {
  password: { label: '账号密码', icon: KeyRound },
  wechat_mp: { label: '微信小程序', icon: MessageCircle },
  alipay_mp: { label: '支付宝小程序', icon: Wallet },
};

export function formatDateTime(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('zh-CN', { hour12: false });
}
