'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { DataTable } from '@/components/data-table';
import type { FilterField } from '@/components/filter-bar';
import { actionsColumn } from '@/lib/admin-table-columns';
import type { AdminColumnDef } from '@/lib/admin-table-types';
import { KeyRound, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { adminFetch } from '@/lib/api';
import { DataTableRowActions } from '@/components/data-table-row-actions';
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
import {
  type Business,
  type BusinessRole,
  type Permission,
  PLATFORM_ROLE_SCOPE,
} from '@/lib/businesses';

const ROLE_FILTERS: FilterField<BusinessRole>[] = [
  {
    id: 'name',
    type: 'text',
    label: '名称',
    placeholder: '搜索角色名称 / 编码...',
    accessor: (row) => `${row.name} ${row.code}`,
  },
];

const EMPTY_ROLE = { code: '', name: '', description: '' };

export default function RolesPage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [businessId, setBusinessId] = useState('');
  const [roles, setRoles] = useState<BusinessRole[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [permOpen, setPermOpen] = useState(false);
  const [selected, setSelected] = useState<BusinessRole | null>(null);
  const [permIds, setPermIds] = useState<string[]>([]);
  const [form, setForm] = useState(EMPTY_ROLE);

  const business = businesses.find((b) => b.id === businessId) ?? null;

  useEffect(() => {
    Promise.all([
      adminFetch<Business[]>('/businesses'),
      adminFetch<Permission[]>('/permissions'),
    ])
      .then(([b, p]) => {
        setBusinesses(b);
        setPermissions(p);
        setBusinessId((prev) => prev || b[0]?.id || '');
      })
      .catch((err) => toast.error(err.message));
  }, []);

  const loadRoles = useCallback(async () => {
    if (!businessId) return;
    setRoles(await adminFetch<BusinessRole[]>(`/roles?businessId=${businessId}`));
  }, [businessId]);

  useEffect(() => {
    loadRoles().catch((err) => toast.error(err.message));
  }, [loadRoles]);

  const openPermDialog = useCallback((role: BusinessRole) => {
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
    }
  }

  // 业务角色只能在能力包范围内勾选；平台级角色不受能力包约束
  const selectablePermissions = useMemo(() => {
    if (!selected?.businessId || !business) return permissions;
    const allowed = new Set(business.permissionIds);
    return permissions.filter((p) => allowed.has(p.id));
  }, [selected, business, permissions]);

  const columns = useMemo<AdminColumnDef<BusinessRole>[]>(
    () => [
      {
        accessorKey: 'code',
        header: '编码',
        meta: { label: '编码' },
        cell: ({ row }) => <span className="font-mono text-xs">{row.original.code}</span>,
      },
      {
        accessorKey: 'name',
        header: '名称',
        meta: { label: '名称' },
        cell: ({ row }) => (
          <span className="flex items-center gap-2">
            {row.original.name}
            {row.original.businessId === null ? (
              <Badge variant="secondary">{PLATFORM_ROLE_SCOPE}</Badge>
            ) : null}
            {business?.defaultRoleId === row.original.id ? (
              <Badge variant="outline">默认</Badge>
            ) : null}
          </span>
        ),
      },
      {
        id: 'permissions',
        header: '功能点',
        accessorFn: (row) => row.permissionCodes?.length ?? 0,
        meta: { label: '功能点数' },
        cell: ({ row }) => row.original.permissionCodes?.length ?? 0,
      },
      actionsColumn({
        id: 'actions',
        header: () => <span className="sr-only">操作</span>,
        meta: { label: '操作' },
        cell: ({ row }) => (
          <DataTableRowActions
            actions={[
              { label: '配置权限', icon: KeyRound, onSelect: () => openPermDialog(row.original) },
            ]}
          />
        ),
      }),
    ],
    [openPermDialog, business],
  );

  return (
    <>
      <PageHeader
        title="角色权限组"
        description="角色归属于业务；业务角色的功能点受该业务能力包限制，平台级角色在所有业务生效"
        actions={
          <>
            {businesses.length > 0 ? (
              <div className="w-48">
                <SelectField
                  label="业务"
                  value={businessId}
                  onChange={setBusinessId}
                  options={businesses.map((b) => ({ value: b.id, label: `${b.name} (${b.code})` }))}
                />
              </div>
            ) : null}
            <Button onClick={() => setCreateOpen(true)} disabled={!businessId}>
              <Plus />
              新建角色
            </Button>
          </>
        }
      />

      <DataTable columns={columns} data={roles} filters={ROLE_FILTERS} emptyMessage="暂无角色" />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>新建角色</DialogTitle>
            <DialogDescription>
              将创建在业务 {business?.name}（{business?.code}）下，编码在业务内唯一
            </DialogDescription>
          </DialogHeader>
          <form id="role-create" className="space-y-4" onSubmit={createRole}>
            <div className="space-y-2">
              <Label htmlFor="role-code">编码</Label>
              <Input
                id="role-code"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role-name">名称</Label>
              <Input
                id="role-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role-desc">描述</Label>
              <Textarea
                id="role-desc"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
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

      <Dialog open={permOpen} onOpenChange={setPermOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>配置功能点</DialogTitle>
            <DialogDescription>
              {selected ? (
                <>
                  {selected.name}{' '}
                  <span className="font-mono text-xs">({selected.code})</span>
                  {selected.businessId ? ' · 仅列出业务能力包内的功能点' : ' · 平台级角色'}
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <PermissionChecklist
            idPrefix="role-perm"
            permissions={selectablePermissions}
            value={permIds}
            onChange={setPermIds}
            emptyMessage="该业务能力包为空，请先在「业务管理」中配置能力包"
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPermOpen(false)}>
              取消
            </Button>
            <Button onClick={savePermissions}>保存权限</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
