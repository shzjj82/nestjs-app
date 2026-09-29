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
interface Role {
  id: string;
  code: string;
  name: string;
  description: string | null;
  permissionIds: string[];
  permissionCodes: string[];
}

interface Permission {
  id: string;
  code: string;
  name: string;
  module: string;
}

const ROLE_FILTERS: FilterField<Role>[] = [
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
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [permOpen, setPermOpen] = useState(false);
  const [selected, setSelected] = useState<Role | null>(null);
  const [permIds, setPermIds] = useState<string[]>([]);
  const [form, setForm] = useState(EMPTY_ROLE);

  async function load() {
    const [r, p] = await Promise.all([
      adminFetch<Role[]>('/roles'),
      adminFetch<Permission[]>('/permissions'),
    ]);
    setRoles(r);
    setPermissions(p);
  }

  useEffect(() => {
    load().catch((err) => toast.error(err.message));
  }, []);

  const openPermDialog = useCallback((role: Role) => {
    setSelected(role);
    setPermIds(role.permissionIds ?? []);
    setPermOpen(true);
  }, []);

  async function createRole(e: React.FormEvent) {
    e.preventDefault();
    try {
      await adminFetch('/roles', { method: 'POST', body: JSON.stringify(form) });
      toast.success('角色已创建');
      setForm(EMPTY_ROLE);
      setCreateOpen(false);
      await load();
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
      toast.success('权限已更新');
      await load();
      const refreshed = await adminFetch<Role[]>('/roles');
      const next = refreshed.find((r) => r.id === selected.id);
      if (next) setSelected(next);
      setPermOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '保存失败');
    }
  }

  const grouped = permissions.reduce<Record<string, Permission[]>>((acc, item) => {
    (acc[item.module] ||= []).push(item);
    return acc;
  }, {});

  const columns = useMemo<AdminColumnDef<Role>[]>(
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
    [openPermDialog],
  );

  return (
    <>
      <PageHeader
        title="角色权限组"
        description="维护角色并勾选功能点"
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus />
            新建角色
          </Button>
        }
      />

        <DataTable columns={columns} data={roles} filters={ROLE_FILTERS} emptyMessage="暂无角色" />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>新建角色</DialogTitle>
            <DialogDescription>创建后可继续配置功能点</DialogDescription>
          </DialogHeader>
          <form id="role-create" className="space-y-4" onSubmit={createRole}>
            <div className="space-y-2">
              <Label>编码</Label>
              <Input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>名称</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>描述</Label>
              <Textarea
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
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {Object.entries(grouped).map(([module, items]) => (
              <div key={module}>
                <div className="mb-2 text-sm font-medium text-muted-foreground">{module}</div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {items.map((p) => (
                    <label
                      key={p.id}
                      className="flex cursor-pointer items-center gap-2 rounded-md border bg-muted/20 p-2.5 text-sm transition-colors hover:bg-muted/40"
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-input"
                        checked={permIds.includes(p.id)}
                        onChange={(e) => {
                          setPermIds((prev) =>
                            e.target.checked
                              ? [...prev, p.id]
                              : prev.filter((id) => id !== p.id),
                          );
                        }}
                      />
                      <span>
                        {p.name}
                        <span className="ml-1 font-mono text-xs text-muted-foreground">
                          {p.code}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
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
