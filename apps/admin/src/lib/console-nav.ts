import {
  Building2,
  ChartLine,
  FileText,
  KeyRound,
  type LucideIcon,
  MessageCircle,
  Shield,
  Upload,
  Users,
} from 'lucide-react';

export type ConsoleNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** 全局搜索额外匹配的关键词 */
  keywords?: string[];
};
export type ConsoleNavGroup = { label: string; items: ConsoleNavItem[] };

export const CONSOLE_NAV_GROUPS: ConsoleNavGroup[] = [
  {
    label: '运维',
    items: [
      { href: '/', label: '运维总览', icon: ChartLine, keywords: ['health', '健康', '服务'] },
      { href: '/upload', label: '上传管理', icon: Upload, keywords: ['upload', '文件'] },
    ],
  },
  {
    label: '用户中心',
    items: [
      { href: '/users', label: '用户', icon: Users, keywords: ['user', '用户中心', '账户', 'account'] },
      { href: '/roles', label: '角色权限组', icon: Shield, keywords: ['role', 'rbac'] },
      { href: '/permissions', label: '功能点', icon: KeyRound, keywords: ['permission', '权限'] },
    ],
  },
  {
    label: '租户',
    items: [
      { href: '/tenants', label: '租户平台', icon: Building2, keywords: ['tenant', 'appCode', 'client'] },
    ],
  },
  {
    label: '业务',
    items: [
      { href: '/wechat', label: '微信小程序', icon: MessageCircle, keywords: ['wechat', 'appId', '小程序码'] },
      { href: '/docs', label: '文档空间', icon: FileText, keywords: ['docs', '文档', '分类'] },
    ],
  },
];

function pathMatches(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function resolveConsoleRoute(pathname: string): {
  group: ConsoleNavGroup | null;
  item: ConsoleNavItem | null;
} {
  for (const group of CONSOLE_NAV_GROUPS) {
    for (const item of group.items) {
      if (pathMatches(pathname, item.href)) {
        return { group, item };
      }
    }
  }
  return { group: null, item: null };
}

export type BreadcrumbSegment = { label: string; href?: string };

export function buildBreadcrumbs(pathname: string): BreadcrumbSegment[] {
  const { group, item } = resolveConsoleRoute(pathname);
  const crumbs: BreadcrumbSegment[] = [{ label: '控制台', href: '/' }];
  if (group) crumbs.push({ label: group.label });
  if (item) {
    crumbs.push({
      label: item.label,
      href: item.href === pathname ? undefined : item.href,
    });
  } else if (!group) {
    crumbs.push({ label: '页面' });
  }
  return crumbs;
}
