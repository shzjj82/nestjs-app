'use client';

import { useCallback, useEffect, useState } from 'react';
import { Ban, CircleCheck } from 'lucide-react';
import { toast } from 'sonner';

import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { adminFetch } from '@/lib/api';
import type { Business, BusinessRole } from '@/lib/businesses';

interface Member {
  id: string;
  userId: string;
  nickname: string;
  username: string | null;
  phone: string | null;
  status: number;
  roleIds: string[];
  roleNames: string[];
  createdAt: string;
}

export function BusinessMembersSheet({
  business,
  onOpenChange,
}: {
  business: Business | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [members, setMembers] = useState<Member[]>([]);
  const [roles, setRoles] = useState<BusinessRole[]>([]);
  const [keyword, setKeyword] = useState('');

  const load = useCallback(async () => {
    if (!business) return;
    const [m, r] = await Promise.all([
      adminFetch<Member[]>(`/businesses/${business.id}/members`),
      adminFetch<BusinessRole[]>(`/roles?businessId=${business.id}`),
    ]);
    setMembers(m);
    setRoles(r.filter((role) => role.businessId === business.id));
  }, [business]);

  useEffect(() => {
    setKeyword('');
    load().catch((err) => toast.error(err instanceof Error ? err.message : '加载失败'));
  }, [load]);

  async function update(member: Member, body: Record<string, unknown>, message: string) {
    if (!business) return;
    try {
      await adminFetch(`/businesses/${business.id}/members/${member.id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      toast.success(message);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '更新失败');
    }
  }

  const text = keyword.trim().toLowerCase();
  const visible = text
    ? members.filter((m) =>
        [m.nickname, m.username, m.phone].some((v) => v?.toLowerCase().includes(text)),
      )
    : members;

  return (
    <Sheet open={!!business} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 data-[side=right]:sm:max-w-2xl">
        <SheetHeader className="border-b">
          <SheetTitle>成员 · {business?.name}</SheetTitle>
          <SheetDescription>
            用户首次登录该业务时自动加入；修改角色或停用后，该成员需重新登录
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索昵称 / 登录名 / 手机..."
          />
          {visible.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无成员</p>
          ) : (
            visible.map((member) => {
              const active = member.status === 1;
              return (
                <div key={member.id} className="space-y-3 rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">
                          {member.nickname || '未命名'}
                        </span>
                        <StatusBadge active={active} />
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {member.username ?? '无账密'}
                        {member.phone ? ` · ${member.phone}` : ''}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        update(
                          member,
                          { status: active ? 0 : 1 },
                          active ? '成员已停用' : '成员已启用',
                        )
                      }
                    >
                      {active ? <Ban /> : <CircleCheck />}
                      {active ? '停用' : '启用'}
                    </Button>
                  </div>
                  {roles.length ? (
                    <div className="grid grid-cols-2 gap-2">
                      {roles.map((role) => {
                        const id = `${member.id}-${role.id}`;
                        const checked = member.roleIds.includes(role.id);
                        return (
                          <div key={role.id} className="flex items-center gap-2">
                            <Checkbox
                              id={id}
                              checked={checked}
                              onCheckedChange={(next) =>
                                update(
                                  member,
                                  {
                                    roleIds: next
                                      ? [...member.roleIds, role.id]
                                      : member.roleIds.filter((r) => r !== role.id),
                                  },
                                  '角色已更新',
                                )
                              }
                            />
                            <Label htmlFor={id} className="font-normal">
                              {role.name}
                              <span className="font-mono text-xs text-muted-foreground">
                                {role.code}
                              </span>
                            </Label>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
