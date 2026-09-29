'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { DataTable } from '@/components/data-table';
import type { FilterField } from '@/components/filter-bar';
import { actionsColumn } from '@/lib/admin-table-columns';
import type { AdminColumnDef } from '@/lib/admin-table-types';
import { Ban, CircleCheck, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { adminFetch } from '@/lib/api';
import { DataTableRowActions } from '@/components/data-table-row-actions';
import { PageHeader } from '@/components/page-header';
import { StatusBadge } from '@/components/status-badge';
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
import { SelectField } from '@/components/select-field';
interface Client {
  id: string;
  appCode: string;
  name: string;
  type: string;
  wechatAppId: string | null;
  hasWechatSecret: boolean;
  alipayAppId: string | null;
  status: number;
}

const TYPES = [
  { value: 'web', label: 'Web' },
  { value: 'wechat_mp', label: '微信小程序' },
  { value: 'alipay_mp', label: '支付宝小程序' },
  { value: 'app', label: 'App' },
];

const FILTERS: FilterField<Client>[] = [
  { id: 'name', type: 'text', label: '名称', placeholder: '搜索名称 / appCode...', accessor: (row) => `${row.name} ${row.appCode}` },
  { id: 'type', type: 'multiSelect', label: '类型', options: TYPES },
  {
    id: 'status',
    type: 'multiSelect',
    label: '状态',
    options: [
      { label: '启用', value: '1' },
      { label: '停用', value: '0' },
    ],
  },
];

const EMPTY_FORM = {
  appCode: '',
  name: '',
  type: 'web',
  wechatAppId: '',
  alipayAppId: '',
};

export default function TenantsPage() {
  const [items, setItems] = useState<Client[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  async function load() {
    setItems(await adminFetch<Client[]>('/clients'));
  }

  useEffect(() => {
    load().catch((err) => toast.error(err.message));
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    try {
      await adminFetch('/clients', {
        method: 'POST',
        body: JSON.stringify({
          appCode: form.appCode,
          name: form.name,
          type: form.type,
          wechatAppId: form.wechatAppId || undefined,
          alipayAppId: form.alipayAppId || undefined,
        }),
      });
      toast.success('租户已创建');
      setForm(EMPTY_FORM);
      setCreateOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '创建失败');
    }
  }

  const toggleStatus = useCallback(async (client: Client) => {
    try {
      await adminFetch(`/clients/${client.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: client.status === 1 ? 0 : 1 }),
      });
      toast.success('状态已更新');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '更新失败');
    }
  }, []);

  const columns = useMemo<AdminColumnDef<Client>[]>(
    () => [
      {
        accessorKey: 'appCode',
        header: 'appCode',
        meta: { label: 'appCode' },
        cell: ({ row }) => (
          <span className="font-mono text-xs">{row.original.appCode}</span>
        ),
      },
      {
        accessorKey: 'name',
        header: '名称',
        meta: { label: '名称' },
      },
      {
        accessorKey: 'type',
        header: '类型',
        meta: { label: '类型' },
        cell: ({ row }) => (
          <Badge variant="outline">
            {TYPES.find((t) => t.value === row.original.type)?.label ?? row.original.type}
          </Badge>
        ),
      },
      {
        accessorKey: 'wechatAppId',
        header: '微信 appId',
        meta: { label: '微信 appId' },
        cell: ({ row }) => (
          <span className="font-mono text-xs">{row.original.wechatAppId || '—'}</span>
        ),
      },
      {
        id: 'status',
        accessorFn: (row) => String(row.status),
        header: '状态',
        meta: { label: '状态' },
        cell: ({ row }) => (
          <StatusBadge active={row.original.status === 1} activeLabel="启用" />
        ),
      },
      actionsColumn({
        id: 'actions',
        header: () => <span className="sr-only">操作</span>,
        meta: { label: '操作' },
        cell: ({ row }) => {
          const active = row.original.status === 1;
          return (
            <DataTableRowActions
              actions={[
                {
                  label: active ? '停用' : '启用',
                  icon: active ? Ban : CircleCheck,
                  variant: active ? 'destructive' : 'default',
                  onSelect: () => toggleStatus(row.original),
                },
              ]}
            />
          );
        },
      }),
    ],
    [toggleStatus],
  );

  return (
    <>
      <PageHeader
        title="租户平台"
        description="接入端 appCode（如 blog），对应文档空间与微信登录指针"
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus />
            新建租户
          </Button>
        }
      />

        <DataTable
          columns={columns}
          data={items}
          filters={FILTERS}
          emptyMessage="暂无租户，点击右上角新建"
        />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>新建租户</DialogTitle>
            <DialogDescription>创建新的接入端 appCode，用于隔离文档与用户身份</DialogDescription>
          </DialogHeader>
          <form id="tenant-create" className="space-y-4" onSubmit={create}>
            <div className="space-y-2">
              <Label>appCode</Label>
              <Input
                value={form.appCode}
                onChange={(e) => setForm({ ...form, appCode: e.target.value })}
                placeholder="blog"
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
            <SelectField
              label="类型"
              value={form.type}
              onChange={(type) => setForm({ ...form, type })}
              options={TYPES}
            />
            <div className="space-y-2">
              <Label>微信 appId / code（可选）</Label>
              <Input
                value={form.wechatAppId}
                onChange={(e) => setForm({ ...form, wechatAppId: e.target.value })}
                placeholder="指向微信服务已登记的 appId"
              />
            </div>
            <div className="space-y-2">
              <Label>支付宝 appId（可选）</Label>
              <Input
                value={form.alipayAppId}
                onChange={(e) => setForm({ ...form, alipayAppId: e.target.value })}
              />
            </div>
          </form>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              取消
            </Button>
            <Button type="submit" form="tenant-create">
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
