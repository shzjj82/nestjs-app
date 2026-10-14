'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { KeyRound, Loader2, Plus, Shield, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';

import { ConsolePage } from '@/components/console-page';
import { DataTable } from '@/components/data-table';
import type { FilterField } from '@/components/filter-bar';
import { PageHeader } from '@/components/page-header';
import { PermissionChecklist } from '@/components/permission-checklist';
import { SelectField } from '@/components/select-field';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { AdminColumnDef } from '@/lib/admin-table-types';
import { adminFetch } from '@/lib/api';
import {
  type Business,
  type BusinessRole,
  type Permission,
  PLATFORM_ROLE_SCOPE,
} from '@/lib/businesses';

function roleKind(role: BusinessRole): 'platform' | 'identity' {
  return role.businessId === null ? 'platform' : 'identity';
}

const ROLE_FILTERS: FilterField<BusinessRole>[] = [
  {
    id: 'keyword',
    type: 'text',
    label: '关键词',
    placeholder: '搜索名称 / 编码 / 描述...',
    accessor: (row) => `${row.name} ${row.code} ${row.description ?? ''}`,
  },
  {
    id: 'kind',
    type: 'multiSelect',
    label: '类型',
    options: [
      { label: '平台级', value: 'platform' },
      { label: '业务身份', value: 'identity' },
    ],
    accessor: (row) => roleKind(row),
  },
];

const EMPTY_ROLE = { code: '', name: '', description: '' };

export function RolesPageClient({
  initialBusinesses,
  initialPermissions,
  initialBusinessId,
  initialRoles,
}: {
  initialBusinesses: Business[];
  initialPermissions: Permission[];
  initialBusinessId: string;
  initialRoles: BusinessRole[];
}) {
  const [businesses] = useState<Business[]>(initialBusinesses);
  const [businessId, setBusinessId] = useState(initialBusinessId);
  const [roles, setRoles] = useState<BusinessRole[]>(initialRoles);
  const [permissions] = useState<Permission[]>(() =>
    initialPermissions.filter(
      (item) => (item.scope ?? 'platform') === 'platform' && !item.adminOnly,
    ),
  );
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [permOpen, setPermOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState<BusinessRole[]>([]);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [selected, setSelected] = useState<BusinessRole | null>(null);
  const [permIds, setPermIds] = useState<string[]>([]);
  const [savingPerms, setSavingPerms] = useState(false);
  const [form, setForm] = useState(EMPTY_ROLE);
  const skipInitialRoles = useRef(true);

  const business = businesses.find((b) => b.id === businessId) ?? null;

  const loadRoles = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    try {
      setRoles(await adminFetch<BusinessRole[]>(`/roles?businessId=${businessId}`));
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    if (skipInitialRoles.current && businessId === initialBusinessId) {
      skipInitialRoles.current = false;
      return;
    }
    skipInitialRoles.current = false;
    loadRoles().catch((err) => toast.error(err.message));
  }, [loadRoles, businessId, initialBusinessId]);

  const openPermDialog = useCallback((role: BusinessRole) => {
    if (role.code === 'admin' && role.businessId === null) {
      toast.error('超级管理员权限由系统维护，不可配置');
      return;
    }
    setSelected(role);
    setPermIds(role.permissionIds ?? []);
    setPermOpen(true);
  }, []);

  async function createRole(e: React.FormEvent) {
    e.preventDefault();
    try {
      await adminFetch('/roles', {
        method: 'POST',
        body: JSON.stringify({ ...form, businessId }),
      });
      toast.success('角色已创建');
      setForm(EMPTY_ROLE);
      setCreateOpen(false);
      await loadRoles();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '创建失败');
    }
  }

  async function savePermissions() {
    if (!selected) return;
    setSavingPerms(true);
    try {
      await adminFetch(`/roles/${selected.id}/permissions`, {
        method: 'PUT',
        body: JSON.stringify({ permissionIds: permIds }),
      });
      toast.success('权限已更新，持有该角色的用户需重新登录');
      setPermOpen(false);
      await loadRoles();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSavingPerms(false);
    }
  }

  async function confirmDelete() {
    if (!deleting.length) return;
    setDeleteBusy(true);
    try {
      await Promise.all(
        deleting.map((role) => adminFetch(`/roles/${role.id}`, { method: 'DELETE' })),
      );
      toast.success(deleting.length === 1 ? '角色已删除' : `已删除 ${deleting.length} 个角色`);
      setDeleteOpen(false);
      setDeleting([]);
      await loadRoles();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '删除失败');
    } finally {
      setDeleteBusy(false);
    }
  }

  const columns = useMemo<AdminColumnDef<BusinessRole>[]>(
    () => [
      {
        id: 'role',
        accessorKey: 'name',
        header: '角色',
        meta: { label: '角色' },
        cell: ({ row }) => {
          const role = row.original;
          const isDefault = business?.defaultRoleId === role.id;
          return (
            <div className="min-w-0 space-y-1 py-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{role.name}</span>
                {isDefault ? <Badge variant="outline">默认授予</Badge> : null}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="font-mono">{role.code}</span>
                {role.description ? (
                  <>
                    <span aria-hidden>·</span>
                    <span className="truncate">{role.description}</span>
                  </>
                ) : null}
              </div>
            </div>
          );
        },
      },
      {
        id: 'kind',
        header: '类型',
        accessorFn: (row) => roleKind(row),
        meta: { label: '类型' },
        cell: ({ row }) =>
          roleKind(row.original) === 'platform' ? (
            <Badge variant="secondary" className="gap-1">
              <Shield className="size-3" />
              {PLATFORM_ROLE_SCOPE}
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1 text-muted-foreground">
              <Users className="size-3" />
              业务身份
            </Badge>
          ),
      },
      {
        id: 'permissions',
        header: '功能点',
        accessorFn: (row) =>
          roleKind(row) === 'identity' ? -1 : (row.permissionCodes?.length ?? 0),
        meta: { label: '功能点' },
        cell: ({ row }) => {
          const role = row.original;
          if (roleKind(role) === 'identity') {
            return (
              <span className="text-xs text-muted-foreground">仅表示身份，不可配权限</span>
            );
          }
          if (role.code === 'admin' && role.businessId === null) {
            return <span className="text-xs text-muted-foreground">系统托管（全部能力）</span>;
          }
          const count = role.permissionCodes?.length ?? 0;
          return (
            <div className="flex items-center gap-2">
              <span className="tabular-nums text-sm font-medium">{count}</span>
              <span className="text-xs text-muted-foreground">项</span>
            </div>
          );
        },
      },
    ],
    [business],
  );

  return (
    <ConsolePage>
      <PageHeader
        title="角色权限组"
        description="业务角色表示身份；平台级角色可配置后台功能点。"
        actions={
          <>
            {businesses.length > 0 ? (
              <SelectField
                value={businessId}
                onChange={setBusinessId}
                triggerClassName="w-48"
                options={businesses.map((b) => ({
                  value: b.id,
                  label: `${b.name} (${b.code})`,
                }))}
              />
            ) : null}
            <Button onClick={() => setCreateOpen(true)} disabled={!businessId || loading}>
              {loading ? <Loader2 className="animate-spin" /> : <Plus />}
              新建角色
            </Button>
          </>
        }
      />

      <DataTable
        columns={columns}
        data={roles}
        filters={ROLE_FILTERS}
        emptyMessage={loading ? '加载中…' : '该业务下暂无角色'}
        bulkActions={({ rows, clearSelection }) => {
          const platformRoles = rows.filter((role) => roleKind(role) === 'platform');
          const identityRoles = rows.filter((role) => roleKind(role) === 'identity');
          const assignable = platformRoles.filter(
            (role) => !(role.code === 'admin' && role.businessId === null),
          );
          return (
            <>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={assignable.length !== 1}
                onClick={() => {
                  if (platformRoles.some((role) => role.code === 'admin' && role.businessId === null)) {
                    toast.error('超级管理员权限由系统维护，不可配置');
                    return;
                  }
                  if (assignable.length !== 1) {
                    toast.error('请只选择一个平台级角色以配置权限');
                    return;
                  }
                  openPermDialog(assignable[0]);
                  clearSelection();
                }}
              >
                <KeyRound />
                配置权限
              </Button>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                disabled={identityRoles.length === 0}
                onClick={() => {
                  if (identityRoles.length === 0) {
                    toast.error('平台级角色不能删除，请选择业务身份角色');
                    return;
                  }
                  if (platformRoles.length > 0) {
                    toast.message(`已忽略 ${platformRoles.length} 个平台级角色`);
                  }
                  setDeleting(identityRoles);
                  setDeleteOpen(true);
                  clearSelection();
                }}
              >
                <Trash2 />
                删除
              </Button>
            </>
          );
        }}
      />

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) setForm(EMPTY_ROLE);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>新建角色</DialogTitle>
            <DialogDescription>
              创建在{' '}
              <span className="font-medium text-foreground">
                {business?.name}（{business?.code}）
              </span>{' '}
              下。业务角色默认是「业务身份」，不绑定功能点；编码在业务内唯一。
            </DialogDescription>
          </DialogHeader>
          <form id="role-create" className="space-y-4" onSubmit={createRole}>
            <div className="space-y-2">
              <Label htmlFor="role-code">编码</Label>
              <Input
                id="role-code"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.trim() })}
                placeholder="例如 agent"
                className="font-mono"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role-name">名称</Label>
              <Input
                id="role-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="例如 业务员"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role-desc">描述（可选）</Label>
              <Textarea
                id="role-desc"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="补充这个身份的用途"
                rows={3}
              />
            </div>
          </form>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              取消
            </Button>
            <Button type="submit" form="role-create">
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open);
          if (!open) setDeleting([]);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>删除角色</DialogTitle>
            <DialogDescription>
              将删除以下业务身份角色（平台级不可删）。若曾是默认授予角色会一并清空；持有者需重新登录。
            </DialogDescription>
          </DialogHeader>
          <ul className="max-h-48 space-y-1 overflow-y-auto rounded-md border p-3 text-sm">
            {deleting.map((role) => (
              <li key={role.id} className="flex items-center justify-between gap-2">
                <span className="font-medium">{role.name}</span>
                <span className="font-mono text-xs text-muted-foreground">{role.code}</span>
              </li>
            ))}
          </ul>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteOpen(false)}>
              取消
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteBusy || deleting.length === 0}
              onClick={() => void confirmDelete()}
            >
              {deleteBusy ? <Loader2 className="animate-spin" /> : <Trash2 />}
              确认删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={permOpen} onOpenChange={setPermOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>配置功能点</DialogTitle>
            <DialogDescription>
              {selected ? (
                <>
                  为平台级角色{' '}
                  <span className="font-medium text-foreground">{selected.name}</span>{' '}
                  <span className="font-mono text-xs">({selected.code})</span>{' '}
                  勾选后台能力。保存后相关用户需重新登录生效。
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2 text-sm">
            <span className="text-muted-foreground">已选功能点</span>
            <span className="tabular-nums font-medium">{permIds.length}</span>
          </div>
          <PermissionChecklist
            idPrefix="role-perm"
            permissions={permissions}
            value={permIds}
            onChange={setPermIds}
            emptyMessage="暂无功能点，请先在「功能点」页创建"
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPermOpen(false)}>
              取消
            </Button>
            <Button onClick={savePermissions} disabled={savingPerms}>
              {savingPerms ? <Loader2 className="animate-spin" /> : null}
              保存权限
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConsolePage>
  );
}