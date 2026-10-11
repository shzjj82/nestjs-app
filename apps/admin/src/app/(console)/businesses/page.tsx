'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { LayoutGrid, Plus } from 'lucide-react';
import { toast } from 'sonner';

import { DataTable } from '@/components/data-table';
import type { FilterField } from '@/components/filter-bar';
import { PageHeader } from '@/components/page-header';
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
import { actionsColumn } from '@/lib/admin-table-columns';
import type { AdminColumnDef } from '@/lib/admin-table-types';
import { adminFetch } from '@/lib/api';
import {
  type Business,
  type BusinessRole,
} from '@/lib/businesses';
import { BusinessModulesSheet } from './business-modules-sheet';

const NO_DEFAULT_ROLE = '__none__';

const FILTERS: FilterField<Business>[] = [
  {
    id: 'name',
    type: 'text',
    label: '名称',
    placeholder: '搜索 code / 名称 / 描述...',
    accessor: (row) => `${row.code} ${row.name} ${row.description ?? ''}`,
  },
];

interface BusinessForm {
  code: string;
  name: string;
  description: string;
  defaultRoleId: string;
}

const EMPTY_FORM: BusinessForm = {
  code: '',
  name: '',
  description: '',
  defaultRoleId: NO_DEFAULT_ROLE,
};

function errorMessage(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

export default function BusinessesPage() {
  const [items, setItems] = useState<Business[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Business | null>(null);
  const [form, setForm] = useState<BusinessForm>(EMPTY_FORM);
  const [editRoles, setEditRoles] = useState<BusinessRole[]>([]);
  const [modulesTarget, setModulesTarget] = useState<Business | null>(null);

  const load = useCallback(async () => {
    setItems(await adminFetch<Business[]>('/businesses'));
  }, []);

  useEffect(() => {
    load().catch((err) => toast.error(errorMessage(err, '加载失败')));
  }, [load]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setEditRoles([]);
    setFormOpen(true);
  }

  const openEdit = useCallback(async (business: Business) => {
    setEditing(business);
    setForm({
      code: business.code,
      name: business.name,
      description: business.description ?? '',
      defaultRoleId: business.defaultRoleId ?? NO_DEFAULT_ROLE,
    });
    setFormOpen(true);
    try {
      const roles = await adminFetch<BusinessRole[]>(`/roles?businessId=${business.id}`);
      setEditRoles(roles.filter((role) => role.businessId === business.id));
    } catch {
      setEditRoles([]);
    }
  }, []);

  async function submitForm(e: React.FormEvent) {
    e.preventDefault();
    const base = {
      name: form.name,
      description: form.description || null,
    };
    try {
      if (editing) {
        await adminFetch(`/businesses/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            ...base,
            defaultRoleId: form.defaultRoleId === NO_DEFAULT_ROLE ? null : form.defaultRoleId,
          }),
        });
        toast.success('业务已更新');
      } else {
        await adminFetch('/businesses', {
          method: 'POST',
          body: JSON.stringify({ ...base, code: form.code }),
        });
        toast.success('业务已创建，已自动生成默认角色 user');
      }
      setFormOpen(false);
      await load();
    } catch (err) {
      toast.error(errorMessage(err, '保存失败'));
    }
  }

  const toggleStatus = useCallback(
    async (business: Business) => {
      try {
        await adminFetch(`/businesses/${business.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ status: business.status === 1 ? 0 : 1 }),
        });
        toast.success(business.status === 1 ? '业务已停用' : '业务已启用');
        await load();
      } catch (err) {
        toast.error(errorMessage(err, '更新失败'));
      }
    },
    [load],
  );

  const columns = useMemo<AdminColumnDef<Business>[]>(
    () => [
      {
        accessorKey: 'code',
        header: 'code',
        meta: { label: 'code' },
        cell: ({ row }) => {
          const business = row.original;
          return (
            <span className="flex items-center gap-2">
              <Button
                type="button"
                variant="link"
                className="h-auto px-0 font-mono text-xs"
                onClick={() => setModulesTarget(business)}
              >
                {business.code}
              </Button>
              {business.isSystem ? <Badge variant="secondary">系统</Badge> : null}
            </span>
          );
        },
      },
      { accessorKey: 'name', header: '业务名称', meta: { label: '业务名称' } },
      {
        accessorKey: 'description',
        header: '业务描述',
        meta: { label: '业务描述' },
        cell: ({ row }) =>
          row.original.description || <span className="text-muted-foreground">—</span>,
      },
      actionsColumn({
        id: 'actions',
        header: () => <span className="sr-only">操作</span>,
        meta: { label: '操作' },
        cell: ({ row }) => {
          const business = row.original;
          return (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setModulesTarget(business)}
            >
              <LayoutGrid />
              开通
            </Button>
          );
        },
      }),
    ],
    []
  );

  return (
    <>
      <PageHeader
        title="业务管理"
        description="点击 code 或「开通」打开侧栏，按接口开通微服务"
        actions={
          <Button onClick={openCreate}>
            <Plus />
            新建业务
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={items}
        filters={FILTERS}
        emptyMessage="暂无业务，点击右上角新建"
      />

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? '编辑业务' : '新建业务'}</DialogTitle>
            <DialogDescription>
              {editing
                ? `业务 code ${editing.code} 创建后不可修改`
                : '创建后点「开通」勾选该业务可用的接口'}
            </DialogDescription>
          </DialogHeader>
          <form id="business-form" className="space-y-4" onSubmit={submitForm}>
            <div className="space-y-2">
              <Label htmlFor="business-code">业务 code</Label>
              <Input
                id="business-code"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="blog"
                disabled={!!editing}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="business-name">名称</Label>
              <Input
                id="business-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="business-desc">描述</Label>
              <Textarea
                id="business-desc"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            {editing ? (
              <SelectField
                label="默认角色（首次登录自动授予）"
                value={form.defaultRoleId}
                onChange={(defaultRoleId) => setForm({ ...form, defaultRoleId })}
                options={[
                  { value: NO_DEFAULT_ROLE, label: '不授予角色' },
                  ...editRoles.map((role) => ({
                    value: role.id,
                    label: `${role.name} (${role.code})`,
                  })),
                ]}
              />
            ) : null}
          </form>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
              取消
            </Button>
            <Button type="submit" form="business-form">
              {editing ? '保存' : '创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BusinessModulesSheet
        business={modulesTarget}
        onOpenChange={(open) => !open && setModulesTarget(null)}
        onSaved={() => load().catch(() => undefined)}
      />
    </>
  );
}
