'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { DataTable } from '@/components/data-table';
import type { FilterField } from '@/components/filter-bar';
import { actionsColumn } from '@/lib/admin-table-columns';
import type { AdminColumnDef } from '@/lib/admin-table-types';
import { Lock, Plus, QrCode } from 'lucide-react';
import { toast } from 'sonner';
import { adminFetch } from '@/lib/api';
import { DataTableRowActions } from '@/components/data-table-row-actions';
import { PageHeader } from '@/components/page-header';
import { StatusBadge } from '@/components/status-badge';
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
interface MiniProgram {
  id: string;
  code: string;
  name: string;
  appId: string;
  hasSecret: boolean;
  status: number;
}

const FILTERS: FilterField<MiniProgram>[] = [
  {
    id: 'name',
    type: 'text',
    label: '名称',
    placeholder: '搜索名称 / code / appId...',
    accessor: (row) => `${row.name} ${row.code} ${row.appId}`,
  },
  {
    id: 'secret',
    type: 'select',
    label: '密钥',
    accessor: (row) => (row.hasSecret ? '1' : '0'),
    options: [
      { label: '已配置', value: '1' },
      { label: '缺失', value: '0' },
    ],
  },
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

const EMPTY_MP = { code: '', name: '', appId: '', secret: '' };

export default function WechatPage() {
  const [items, setItems] = useState<MiniProgram[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [qrcodeOpen, setQrcodeOpen] = useState(false);
  const [secretOpen, setSecretOpen] = useState(false);
  const [secretTarget, setSecretTarget] = useState<MiniProgram | null>(null);
  const [form, setForm] = useState(EMPTY_MP);
  const [newSecret, setNewSecret] = useState('');
  const [qrcode, setQrcode] = useState({ code: '', scene: 'admin=1', page: '' });

  async function load() {
    setItems(await adminFetch<MiniProgram[]>('/wechat/miniprograms'));
  }

  useEffect(() => {
    load().catch((err) => toast.error(err.message));
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    try {
      await adminFetch('/wechat/miniprograms', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      toast.success('小程序已登记');
      setForm(EMPTY_MP);
      setCreateOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '创建失败');
    }
  }

  const openSecret = useCallback((mp: MiniProgram) => {
    setSecretTarget(mp);
    setNewSecret('');
    setSecretOpen(true);
  }, []);

  async function rotateSecret() {
    if (!secretTarget) return;
    const secret = newSecret.trim();
    if (!secret) {
      toast.error('请输入新 secret');
      return;
    }
    try {
      await adminFetch(`/wechat/miniprograms/${secretTarget.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ secret }),
      });
      toast.success('secret 已更新');
      setSecretOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '更新失败');
    }
  }

  async function downloadQrcode(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch('/api/proxy/wechat/qrcode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: qrcode.code,
          scene: qrcode.scene,
          page: qrcode.page || undefined,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || '生成失败');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `qrcode-${qrcode.code || 'mp'}.png`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('小程序码已下载');
      setQrcodeOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '生成失败');
    }
  }

  const columns = useMemo<AdminColumnDef<MiniProgram>[]>(
    () => [
      {
        accessorKey: 'code',
        header: 'code',
        meta: { label: 'code' },
        cell: ({ row }) => <span className="font-mono text-xs">{row.original.code}</span>,
      },
      {
        accessorKey: 'name',
        header: '名称',
        meta: { label: '名称' },
      },
      {
        accessorKey: 'appId',
        header: 'appId',
        meta: { label: 'appId' },
        cell: ({ row }) => <span className="font-mono text-xs">{row.original.appId}</span>,
      },
      {
        id: 'secret',
        accessorFn: (row) => (row.hasSecret ? '1' : '0'),
        header: '密钥',
        meta: { label: '密钥' },
        cell: ({ row }) => (
          <StatusBadge active={row.original.hasSecret} activeLabel="已配置" inactiveLabel="缺失" />
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
        cell: ({ row }) => (
          <DataTableRowActions
            actions={[{ label: '轮换密钥', icon: Lock, onSelect: () => openSecret(row.original) }]}
          />
        ),
      }),
    ],
    [openSecret],
  );

  return (
    <>
      <PageHeader
        title="微信小程序"
        description="多套 appId / secret 登记；列表不回传密钥"
        actions={
          <>
            <Button variant="outline" onClick={() => setQrcodeOpen(true)}>
              <QrCode />
              生成小程序码
            </Button>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus />
              登记小程序
            </Button>
          </>
        }
      />

        <DataTable
          columns={columns}
          data={items}
          filters={FILTERS}
          emptyMessage="暂无登记，点击右上角登记小程序"
        />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>登记小程序</DialogTitle>
            <DialogDescription>密钥仅存储于微信微服务，列表不会回显</DialogDescription>
          </DialogHeader>
          <form id="wechat-create" className="space-y-4" onSubmit={create}>
            <div className="space-y-2">
              <Label>业务 code</Label>
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
              <Label>微信 appId</Label>
              <Input
                value={form.appId}
                onChange={(e) => setForm({ ...form, appId: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>appSecret</Label>
              <Input
                type="password"
                value={form.secret}
                onChange={(e) => setForm({ ...form, secret: e.target.value })}
                required
              />
            </div>
          </form>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              取消
            </Button>
            <Button type="submit" form="wechat-create">
              登记
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={secretOpen} onOpenChange={setSecretOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>轮换 secret</DialogTitle>
            <DialogDescription>
              {secretTarget ? (
                <>
                  {secretTarget.name}{' '}
                  <span className="font-mono text-xs">({secretTarget.code})</span>
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>新 appSecret</Label>
            <Input
              type="password"
              value={newSecret}
              onChange={(e) => setNewSecret(e.target.value)}
              placeholder="输入新的微信小程序密钥"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSecretOpen(false)}>
              取消
            </Button>
            <Button onClick={rotateSecret}>更新</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={qrcodeOpen} onOpenChange={setQrcodeOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>生成小程序码</DialogTitle>
            <DialogDescription>生成后自动下载 PNG 文件</DialogDescription>
          </DialogHeader>
          <form id="qrcode-form" className="space-y-4" onSubmit={downloadQrcode}>
            <div className="space-y-2">
              <Label>小程序 code</Label>
              <Input
                value={qrcode.code}
                onChange={(e) => setQrcode({ ...qrcode, code: e.target.value })}
                placeholder={items[0]?.code || 'mall'}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>scene</Label>
              <Input
                value={qrcode.scene}
                onChange={(e) => setQrcode({ ...qrcode, scene: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>page（可选）</Label>
              <Input
                value={qrcode.page}
                onChange={(e) => setQrcode({ ...qrcode, page: e.target.value })}
                placeholder="pages/index/index"
              />
            </div>
          </form>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setQrcodeOpen(false)}>
              取消
            </Button>
            <Button type="submit" form="qrcode-form">
              下载 PNG
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
