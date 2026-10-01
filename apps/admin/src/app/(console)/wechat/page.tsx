'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { DataTable } from '@/components/data-table';
import { DataTableRowActions } from '@/components/data-table-row-actions';
import type { FilterField } from '@/components/filter-bar';
import { PageHeader } from '@/components/page-header';
import { SelectField } from '@/components/select-field';
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
import { actionsColumn } from '@/lib/admin-table-columns';
import type { AdminColumnDef } from '@/lib/admin-table-types';
import { adminFetch } from '@/lib/api';
import type { Business } from '@/lib/businesses';
import type { BusinessAppClient, RegisteredWechatApp } from '@/lib/wechat-apps';

interface WechatRow {
  id: string;
  businessName: string;
  appCode: string;
  appId: string;
}

const FILTERS: FilterField<WechatRow>[] = [
  {
    id: 'appCode',
    type: 'text',
    label: 'appCode',
    placeholder: '搜索业务名称 / appCode / appId...',
    accessor: (row) => `${row.businessName} ${row.appCode} ${row.appId}`,
  },
];

const UNSELECTED = '__pick__';
const EMPTY_FORM = { businessId: UNSELECTED, appId: '', secret: '' };

interface WechatForm {
  businessId: string;
  appId: string;
  secret: string;
}

export default function WechatPage() {
  const [apps, setApps] = useState<RegisteredWechatApp[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<WechatForm>(EMPTY_FORM);
  const [editing, setEditing] = useState<WechatRow | null>(null);
  const [editForm, setEditForm] = useState<WechatForm>(EMPTY_FORM);
  const [deleting, setDeleting] = useState<WechatRow | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [nextApps, nextBusinesses] = await Promise.all([
      adminFetch<RegisteredWechatApp[]>('/wechat/miniprograms'),
      adminFetch<Business[]>('/businesses'),
    ]);
    setApps(nextApps);
    setBusinesses(nextBusinesses);
  }, []);

  useEffect(() => {
    load().catch((err) => toast.error(err instanceof Error ? err.message : '加载失败'));
  }, [load]);

  const rows = useMemo<WechatRow[]>(
    () =>
      apps.map((app) => {
        const business = businesses.find((item) => item.code === app.code);
        return {
          id: app.id,
          businessName: business?.name ?? app.name,
          appCode: app.code,
          appId: app.appId,
        };
      }),
    [apps, businesses],
  );

  const availableBusinesses = useMemo(() => {
    const used = new Set(apps.map((app) => app.code));
    return businesses.filter((business) => !used.has(business.code));
  }, [apps, businesses]);

  const editBusinesses = useMemo(() => {
    if (!editing) return [];
    const used = new Set(apps.map((app) => app.code));
    return businesses.filter(
      (business) => business.code === editing.appCode || !used.has(business.code),
    );
  }, [apps, businesses, editing]);

  function openCreate() {
    setForm(EMPTY_FORM);
    setCreateOpen(true);
  }

  function openEdit(row: WechatRow) {
    const business = businesses.find((item) => item.code === row.appCode);
    setEditForm({
      businessId: business?.id ?? UNSELECTED,
      appId: row.appId,
      secret: '',
    });
    setEditing(row);
  }

  async function ensureClient(business: Business, appId: string) {
    const clients = await adminFetch<BusinessAppClient[]>('/clients');
    const existing = clients.find((client) => client.appCode === business.code);
    if (existing) {
      await adminFetch(`/clients/${existing.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          businessId: business.id,
          type: 'wechat_mp',
          wechatAppId: appId,
          status: 1,
        }),
      });
      return;
    }
    await adminFetch('/clients', {
      method: 'POST',
      body: JSON.stringify({
        businessId: business.id,
        appCode: business.code,
        name: business.name,
        type: 'wechat_mp',
        wechatAppId: appId,
      }),
    });
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const business =
      form.businessId === UNSELECTED
        ? undefined
        : businesses.find((item) => item.id === form.businessId);
    const appId = form.appId.trim();
    const secret = form.secret.trim();
    if (!business) {
      toast.error('请选择业务');
      return;
    }
    if (!appId || !secret) {
      toast.error('请填写 appId 和 appSecret');
      return;
    }
    try {
      await adminFetch('/wechat/miniprograms', {
        method: 'POST',
        body: JSON.stringify({
          code: business.code,
          name: business.name,
          appId,
          secret,
        }),
      });
      await ensureClient(business, appId);
      toast.success('已添加');
      setForm(EMPTY_FORM);
      setCreateOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '添加失败');
    }
  }

  async function unlinkClient(appCode: string) {
    const clients = await adminFetch<BusinessAppClient[]>('/clients');
    const existing = clients.find((client) => client.appCode === appCode);
    if (!existing) return;
    await adminFetch(`/clients/${existing.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ wechatAppId: null, status: 0 }),
    });
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    const business =
      editForm.businessId === UNSELECTED
        ? undefined
        : businesses.find((item) => item.id === editForm.businessId);
    const appId = editForm.appId.trim();
    const secret = editForm.secret.trim();
    if (!business) {
      toast.error('请选择业务');
      return;
    }
    if (!appId) {
      toast.error('请填写 appId');
      return;
    }
    setBusy(true);
    try {
      await adminFetch(`/wechat/miniprograms/${editing.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          code: business.code,
          name: business.name,
          appId,
          ...(secret ? { secret } : {}),
        }),
      });
      if (editing.appCode !== business.code) {
        await unlinkClient(editing.appCode);
      }
      await ensureClient(business, appId);
      toast.success('已保存');
      setEditing(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '保存失败');
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    try {
      await adminFetch(`/wechat/miniprograms/${deleting.id}`, { method: 'DELETE' });
      await unlinkClient(deleting.appCode);
      toast.success('已删除');
      setDeleting(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '删除失败');
    } finally {
      setBusy(false);
    }
  }

  const columns = useMemo<AdminColumnDef<WechatRow>[]>(
    () => [
      {
        accessorKey: 'businessName',
        header: '业务名称',
        meta: { label: '业务名称' },
      },
      {
        accessorKey: 'appCode',
        header: 'appCode',
        meta: { label: 'appCode' },
        cell: ({ row }) => <span className="font-mono text-xs">{row.original.appCode}</span>,
      },
      {
        accessorKey: 'appId',
        header: 'appId',
        meta: { label: 'appId' },
        cell: ({ row }) => <span className="font-mono text-xs">{row.original.appId}</span>,
      },
      actionsColumn({
        id: 'actions',
        header: () => <span className="sr-only">操作</span>,
        meta: { label: '操作' },
        cell: ({ row }) => (
          <DataTableRowActions
            actions={[
              { label: '编辑', icon: Pencil, onSelect: () => openEdit(row.original) },
              {
                label: '删除',
                icon: Trash2,
                variant: 'destructive',
                separatorBefore: true,
                onSelect: () => setDeleting(row.original),
              },
            ]}
          />
        ),
      }),
    ],
    [businesses],
  );

  return (
    <>
      <PageHeader
        title="微信小程序"
        description="一个业务 code 只登记一条。需要时再添加 appId 和 appSecret，列表不显示密钥"
        actions={
          <Button onClick={openCreate}>
            <Plus />
            添加
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={rows}
        filters={FILTERS}
        emptyMessage="暂无记录。需要哪个业务再用它的 code 添加"
      />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>添加微信小程序</DialogTitle>
            <DialogDescription>appCode 使用业务管理里的 code，每个 code 只能添加一次</DialogDescription>
          </DialogHeader>
          <form id="wechat-create" className="space-y-4" onSubmit={create}>
            <SelectField
              label="业务"
              value={form.businessId}
              onChange={(businessId) => setForm({ ...form, businessId })}
              options={
                availableBusinesses.length
                  ? [
                      { value: UNSELECTED, label: '选择业务' },
                      ...availableBusinesses.map((business) => ({
                        value: business.id,
                        label: `${business.name}（${business.code}）`,
                      })),
                    ]
                  : [{ value: UNSELECTED, label: '没有可添加的业务' }]
              }
            />
            <div className="space-y-2">
              <Label htmlFor="wechat-app-id">appId</Label>
              <Input
                id="wechat-app-id"
                value={form.appId}
                onChange={(e) => setForm({ ...form, appId: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wechat-app-secret">appSecret</Label>
              <Input
                id="wechat-app-secret"
                type="password"
                value={form.secret}
                onChange={(e) => setForm({ ...form, secret: e.target.value })}
                autoComplete="new-password"
                required
              />
            </div>
          </form>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              取消
            </Button>
            <Button type="submit" form="wechat-create" disabled={!availableBusinesses.length}>
              添加
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editing} onOpenChange={(open) => !open && !busy && setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>编辑微信小程序</DialogTitle>
            <DialogDescription>appSecret 留空则保持原密钥，列表不会显示密钥</DialogDescription>
          </DialogHeader>
          <form id="wechat-edit" className="space-y-4" onSubmit={saveEdit}>
            <SelectField
              label="业务"
              value={editForm.businessId}
              onChange={(businessId) => setEditForm({ ...editForm, businessId })}
              options={[
                ...(editForm.businessId === UNSELECTED
                  ? [{ value: UNSELECTED, label: '选择业务' }]
                  : []),
                ...editBusinesses.map((business) => ({
                  value: business.id,
                  label: `${business.name}（${business.code}）`,
                })),
              ]}
            />
            <div className="space-y-2">
              <Label htmlFor="wechat-edit-app-id">appId</Label>
              <Input
                id="wechat-edit-app-id"
                value={editForm.appId}
                onChange={(e) => setEditForm({ ...editForm, appId: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wechat-edit-app-secret">appSecret</Label>
              <Input
                id="wechat-edit-app-secret"
                type="password"
                value={editForm.secret}
                onChange={(e) => setEditForm({ ...editForm, secret: e.target.value })}
                placeholder="留空则不修改"
                autoComplete="new-password"
              />
            </div>
          </form>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={() => setEditing(null)}>
              取消
            </Button>
            <Button type="submit" form="wechat-edit" disabled={busy || !editBusinesses.length}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleting} onOpenChange={(open) => !open && !busy && setDeleting(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>删除这条记录？</DialogTitle>
            <DialogDescription>
              {deleting
                ? `将删除 ${deleting.businessName}（${deleting.appCode}）的微信配置`
                : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={() => setDeleting(null)}>
              取消
            </Button>
            <Button variant="destructive" disabled={busy} onClick={confirmDelete}>
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
