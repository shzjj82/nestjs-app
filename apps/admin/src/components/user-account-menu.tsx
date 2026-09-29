'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import type { AdminUser } from '@/lib/auth';
import { adminFetch } from '@/lib/api';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const ROLE_LABELS: Record<string, string> = {
  admin: '超级管理员',
  user: '普通用户',
};

function avatarInitial(user: AdminUser) {
  const base = user.nickname?.trim() || user.username?.trim() || '管';
  return base.slice(0, 1).toUpperCase();
}

function AccountSummary({ user, compact }: { user: AdminUser; compact?: boolean }) {
  const title = user.nickname?.trim() || user.username || '管理员';
  const roles = user.roles ?? [];

  return (
    <div className={compact ? 'min-w-0' : 'space-y-1'}>
      <div className={compact ? 'truncate text-sm font-medium leading-tight' : 'text-sm font-medium'}>
        {title}
      </div>
      {user.username ? (
        <div className="truncate text-xs text-muted-foreground">登录名 {user.username}</div>
      ) : null}
      {!compact && user.phone ? (
        <div className="truncate text-xs text-muted-foreground">{user.phone}</div>
      ) : null}
      {!compact && user.email ? (
        <div className="truncate text-xs text-muted-foreground">{user.email}</div>
      ) : null}
      {!compact && roles.length > 0 ? (
        <div className="flex flex-wrap gap-1 pt-1.5">
          {roles.map((code) => (
            <Badge key={code} variant="secondary" className="font-normal">
              {ROLE_LABELS[code] ?? code}
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function UserAccountMenu({ user }: { user: AdminUser }) {
  const router = useRouter();
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/login');
    router.refresh();
  }

  function openPasswordDialog() {
    setForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
    setPasswordOpen(true);
  }

  async function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    if (form.newPassword !== form.confirmPassword) {
      toast.error('两次输入的新密码不一致');
      return;
    }
    setSaving(true);
    try {
      await adminFetch('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          oldPassword: form.oldPassword,
          newPassword: form.newPassword,
        }),
      });
      toast.success('密码已更新');
      setPasswordOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '修改失败');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className="flex max-w-[200px] items-center gap-2.5 rounded-md p-1 text-left outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="账号菜单"
        >
          <Avatar className="size-8">
            <AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">
              {avatarInitial(user)}
            </AvatarFallback>
          </Avatar>
          <div className="hidden min-w-0 md:block">
            <AccountSummary user={user} compact />
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64 p-0">
          <div className="border-b px-3 py-2.5">
            <AccountSummary user={user} />
          </div>
          <div className="p-1">
            <DropdownMenuItem onSelect={openPasswordDialog}>
              <Lock />
              修改密码
            </DropdownMenuItem>
            <DropdownMenuSeparator className="my-1" />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={() => {
                void logout();
              }}
            >
              <LogOut />
              退出登录
            </DropdownMenuItem>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={passwordOpen} onOpenChange={setPasswordOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>修改密码</DialogTitle>
            <DialogDescription>修改当前登录账号的密码，需验证原密码</DialogDescription>
          </DialogHeader>
          <form id="change-password-form" className="space-y-4" onSubmit={submitPassword}>
            <div className="space-y-2">
              <Label htmlFor="old-password">当前密码</Label>
              <Input
                id="old-password"
                type="password"
                autoComplete="current-password"
                value={form.oldPassword}
                onChange={(e) => setForm({ ...form, oldPassword: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">新密码</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={form.newPassword}
                onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
                minLength={6}
                maxLength={64}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">确认新密码</Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                value={form.confirmPassword}
                onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                minLength={6}
                maxLength={64}
                required
              />
            </div>
          </form>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPasswordOpen(false)}>
              取消
            </Button>
            <Button type="submit" form="change-password-form" disabled={saving}>
              {saving ? '保存中…' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
