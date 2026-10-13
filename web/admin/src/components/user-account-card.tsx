'use client';

import { useState } from 'react';
import { Ban, CircleCheck } from 'lucide-react';

import { StatusBadge } from '@/components/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ACCOUNT_TYPE_META, formatDateTime, type UserAccount } from '@/lib/accounts';

export interface RoleOption {
  id: string;
  code: string;
  name: string;
  businessLabel?: string;
}

export function UserAccountCard({
  account,
  roles,
  onSaveRoles,
  onToggleStatus,
}: {
  account: UserAccount;
  roles: RoleOption[];
  onSaveRoles: (roleIds: string[]) => Promise<void>;
  onToggleStatus: () => Promise<void>;
}) {
  const meta = ACCOUNT_TYPE_META[account.type];
  const Icon = meta?.icon;
  const [roleIds, setRoleIds] = useState<string[]>(account.roleIds);
  const [saving, setSaving] = useState(false);
  const dirty =
    roleIds.length !== account.roleIds.length ||
    roleIds.some((id) => !account.roleIds.includes(id));
  const active = account.status === 1;

  async function run(action: () => Promise<void>) {
    setSaving(true);
    try {
      await action();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border">
      <div className="flex items-start justify-between gap-3 border-b p-3">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">
              {Icon ? <Icon /> : null}
              {meta?.label ?? account.type}
            </Badge>
            <StatusBadge active={active} />
          </div>
          <div className="truncate font-mono text-sm" title={account.identifier}>
            {account.identifier}
          </div>
          <div className="text-xs text-muted-foreground">
            最近登录 {formatDateTime(account.lastLoginAt)} · 创建于 {formatDateTime(account.createdAt)}
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          disabled={saving}
          onClick={() => run(onToggleStatus)}
        >
          {active ? <Ban /> : <CircleCheck />}
          {active ? '停用' : '启用'}
        </Button>
      </div>
      <div className="space-y-3 p-3">
        <div className="text-xs font-medium text-muted-foreground">角色</div>
        <div className="grid grid-cols-2 gap-2">
          {roles.map((role) => {
            const id = `${account.id}-${role.id}`;
            return (
              <div key={role.id} className="flex items-center gap-2">
                <Checkbox
                  id={id}
                  checked={roleIds.includes(role.id)}
                  onCheckedChange={(checked) =>
                    setRoleIds((prev) =>
                      checked ? [...prev, role.id] : prev.filter((r) => r !== role.id),
                    )
                  }
                />
                <Label htmlFor={id} className="font-normal">
                  {role.name}
                  <span className="font-mono text-xs text-muted-foreground">{role.code}</span>
                  {role.businessLabel ? (
                    <Badge variant="outline">{role.businessLabel}</Badge>
                  ) : null}
                </Label>
              </div>
            );
          })}
        </div>
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!dirty || saving}
            onClick={() => setRoleIds(account.roleIds)}
          >
            还原
          </Button>
          <Button size="sm" disabled={!dirty || saving} onClick={() => run(() => onSaveRoles(roleIds))}>
            保存角色
          </Button>
        </div>
      </div>
    </div>
  );
}
