'use client';

import { useEffect, useMemo, useState } from 'react';
import { DataTable } from '@/components/data-table';
import type { FilterField } from '@/components/filter-bar';
import type { AdminColumnDef } from '@/lib/admin-table-types';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { adminFetch, readApiResponse } from '@/lib/api';
import { PageHeader } from '@/components/page-header';
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
interface Permission {
  id: string;
  module: string;
  code: string;
  name: string;
  description: string | null;
  sort: number;
}

const DEFAULT_FORM = {
  module: '用户',
  code: '',
  name: '',
  description: '',
  sort: '10',
};

export default function PermissionsPage() {
  const [items, setItems] = useState<Permission[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(DEFAULT_FORM);

  async function load() {
    setItems(await adminFetch<Permission[]>('/permissions'));
  }

  useEffect(() => {
    load().catch((err) => toast.error(err.message));
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    try {
      await adminFetch('/permissions', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          sort: Number(form.sort) || 0,
        }),
      });
      toast.success('已创建功能点');
      setForm({ ...DEFAULT_FORM, module: form.module, sort: form.sort });
      setCreateOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '创建失败');
    }
  }

  async function exportExcel() {
    try {
      const res = await fetch('/api/proxy/permissions/export');
      if (!res.ok) throw new Error((await readApiResponse(res)).message);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'permissions.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '导出失败');
    }
  }

  async function importExcel(file: File | null) {
    if (!file) return;
    const body = new FormData();
    body.append('file', file);
    try {
      await adminFetch('/permissions/import', { method: 'POST', body });
      toast.success('导入成功');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '导入失败');
    }
  }

  const filters = useMemo<FilterField<Permission>[]>(
    () => [
      {
        id: 'name',
        type: 'text',
        label: '名称',
        placeholder: '搜索名称 / 编码...',
        accessor: (row) => `${row.name} ${row.code}`,
      },
      {
        id: 'module',
        type: 'multiSelect',
        label: '模块',
        options: [...new Set(items.map((p) => p.module))].map((m) => ({
          label: m,
          value: m,
          count: items.filter((p) => p.module === m).length,
        })),
      },
    ],
    [items],
  );

  const columns = useMemo<AdminColumnDef<Permission>[]>(
    () => [
      {
        accessorKey: 'module',
        header: '模块',
        meta: { label: '模块' },
        cell: ({ row }) => <Badge variant="outline">{row.original.module}</Badge>,
      },
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
        accessorKey: 'sort',
        header: '排序',
        meta: { label: '排序' },
      },
    ],
    [],
  );

  return (
    <>
      <PageHeader
        title="功能点"
        description="全局权限目录，支持 Excel 导入导出"
        actions={
          <>
            <Button variant="outline" onClick={exportExcel}>
              导出 Excel
            </Button>
            <label className="inline-flex h-10 cursor-pointer items-center rounded-md border border-input bg-background px-4 text-sm font-medium hover:bg-muted/50">
              导入 Excel
              <input
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => importExcel(e.target.files?.[0] ?? null)}
              />
            </label>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus />
              新建功能点
            </Button>
          </>
        }
      />

        <DataTable columns={columns} data={items} filters={filters} emptyMessage="暂无功能点" />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>新建功能点</DialogTitle>
            <DialogDescription>添加到全局权限目录，供角色勾选</DialogDescription>
          </DialogHeader>
          <form id="perm-create" className="space-y-4" onSubmit={create}>
            <div className="space-y-2">
              <Label>模块</Label>
              <Input
                value={form.module}
                onChange={(e) => setForm({ ...form, module: e.target.value })}
                required
              />
            </div>
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
              <Label>排序</Label>
              <Input
                value={form.sort}
                onChange={(e) => setForm({ ...form, sort: e.target.value })}
              />
            </div>
          </form>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              取消
            </Button>
            <Button type="submit" form="perm-create">
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
