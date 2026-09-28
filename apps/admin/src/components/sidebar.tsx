'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Activity,
  FileText,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Shield,
  Smartphone,
  Upload,
  Users,
  Building2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

const NAV = [
  { href: '/', label: '运维总览', icon: Activity },
  { href: '/users', label: '用户账号', icon: Users },
  { href: '/roles', label: '角色权限组', icon: Shield },
  { href: '/permissions', label: '功能点', icon: KeyRound },
  { href: '/tenants', label: '租户平台', icon: Building2 },
  { href: '/wechat', label: '微信小程序', icon: Smartphone },
  { href: '/docs', label: '文档空间', icon: FileText },
  { href: '/upload', label: '上传管理', icon: Upload },
];

export function Sidebar({
  user,
}: {
  user: { nickname?: string; username?: string | null };
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/login');
    router.refresh();
  }

  return (
    <aside className="flex h-screen w-64 flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-2 px-5 py-5">
        <LayoutDashboard className="h-5 w-5" />
        <div>
          <div className="text-sm font-semibold">管理控制台</div>
          <div className="text-xs text-sidebar-foreground/70">NestJS Admin</div>
        </div>
      </div>
      <Separator className="bg-sidebar-muted" />
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {NAV.map((item) => {
          const active =
            item.href === '/'
              ? pathname === '/'
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                active
                  ? 'bg-sidebar-muted text-white'
                  : 'text-sidebar-foreground/80 hover:bg-sidebar-muted/70 hover:text-white',
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-sidebar-muted p-4">
        <div className="mb-3 truncate text-sm">
          {user.nickname || user.username || '管理员'}
        </div>
        <Button
          variant="secondary"
          size="sm"
          className="w-full justify-start gap-2"
          onClick={logout}
        >
          <LogOut className="h-4 w-4" />
          退出登录
        </Button>
      </div>
    </aside>
  );
}
