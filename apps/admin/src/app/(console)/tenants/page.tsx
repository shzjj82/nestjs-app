'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { adminFetch } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

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

export default function TenantsPage() {
  const [items, setItems] = useState<Client[]>([]);
  const [form, setForm] = useState({
    appCode: '',
    name: '',
    type: 'web',
    wechatAppId: '',
    alipayAppId: '',
  });

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
      setForm({ appCode: '', name: '', type: 'web', wechatAppId: '', alipayAppId: '' });
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '创建失败');
    }
  }

  async function toggleStatus(client: Client) {
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
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">租户平台</h1>
        <p className="text-sm text-muted-foreground">
          接入端 appCode（如 blog），对应文档空间与微信登录指针
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>接入端列表</CardTitle>
            <CardDescription>共 {items.length} 个</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>appCode</TableHead>
                  <TableHead>名称</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>微信 appId</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-xs">{c.appCode}</TableCell>
                    <TableCell>{c.name}</TableCell>
                    <TableCell>{c.type}</TableCell>
                    <TableCell className="font-mono text-xs">{c.wechatAppId || '—'}</TableCell>
                    <TableCell>
                      <Badge variant={c.status === 1 ? 'success' : 'danger'}>
                        {c.status === 1 ? '启用' : '停用'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={() => toggleStatus(c)}>
                        {c.status === 1 ? '停用' : '启用'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>新建租户</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={create}>
              <div className="space-y-1">
                <Label>appCode</Label>
                <Input
                  value={form.appCode}
                  onChange={(e) => setForm({ ...form, appCode: e.target.value })}
                  placeholder="blog"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label>名称</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label>类型</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                >
                  {TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label>微信 appId / code（可选）</Label>
                <Input
                  value={form.wechatAppId}
                  onChange={(e) => setForm({ ...form, wechatAppId: e.target.value })}
                  placeholder="指向微信服务已登记的 appId"
                />
              </div>
              <div className="space-y-1">
                <Label>支付宝 appId（可选）</Label>
                <Input
                  value={form.alipayAppId}
                  onChange={(e) => setForm({ ...form, alipayAppId: e.target.value })}
                />
              </div>
              <Button type="submit" className="w-full">
                创建
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
