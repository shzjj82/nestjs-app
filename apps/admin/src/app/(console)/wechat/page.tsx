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

interface MiniProgram {
  id: string;
  code: string;
  name: string;
  appId: string;
  hasSecret: boolean;
  status: number;
}

export default function WechatPage() {
  const [items, setItems] = useState<MiniProgram[]>([]);
  const [form, setForm] = useState({
    code: '',
    name: '',
    appId: '',
    secret: '',
  });
  const [secretEdit, setSecretEdit] = useState<Record<string, string>>({});
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
      setForm({ code: '', name: '', appId: '', secret: '' });
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '创建失败');
    }
  }

  async function rotateSecret(id: string) {
    const secret = secretEdit[id]?.trim();
    if (!secret) {
      toast.error('请输入新 secret');
      return;
    }
    try {
      await adminFetch(`/wechat/miniprograms/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ secret }),
      });
      toast.success('secret 已更新');
      setSecretEdit((prev) => ({ ...prev, [id]: '' }));
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
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '生成失败');
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">微信小程序</h1>
        <p className="text-sm text-muted-foreground">
          多套 appId / secret 登记；列表不回传密钥
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>已登记小程序</CardTitle>
            <CardDescription>共 {items.length} 套</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>code</TableHead>
                  <TableHead>名称</TableHead>
                  <TableHead>appId</TableHead>
                  <TableHead>密钥</TableHead>
                  <TableHead>状态</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((mp) => (
                  <TableRow key={mp.id}>
                    <TableCell className="font-mono text-xs">{mp.code}</TableCell>
                    <TableCell>{mp.name}</TableCell>
                    <TableCell className="font-mono text-xs">{mp.appId}</TableCell>
                    <TableCell>
                      <Badge variant={mp.hasSecret ? 'success' : 'danger'}>
                        {mp.hasSecret ? '已配置' : '缺失'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={mp.status === 1 ? 'success' : 'danger'}>
                        {mp.status === 1 ? '启用' : '停用'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="space-y-3">
              <div className="text-sm font-medium">轮换 secret</div>
              {items.map((mp) => (
                <div key={mp.id} className="flex flex-wrap items-center gap-2">
                  <span className="w-24 font-mono text-xs">{mp.code}</span>
                  <Input
                    type="password"
                    className="max-w-xs"
                    placeholder="新 secret"
                    value={secretEdit[mp.id] ?? ''}
                    onChange={(e) =>
                      setSecretEdit((prev) => ({ ...prev, [mp.id]: e.target.value }))
                    }
                  />
                  <Button size="sm" variant="outline" onClick={() => rotateSecret(mp.id)}>
                    更新
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>登记小程序</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-3" onSubmit={create}>
                <div className="space-y-1">
                  <Label>业务 code</Label>
                  <Input
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
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
                  <Label>微信 appId</Label>
                  <Input
                    value={form.appId}
                    onChange={(e) => setForm({ ...form, appId: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label>appSecret</Label>
                  <Input
                    type="password"
                    value={form.secret}
                    onChange={(e) => setForm({ ...form, secret: e.target.value })}
                    required
                  />
                </div>
                <Button type="submit" className="w-full">
                  登记
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>生成小程序码</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-3" onSubmit={downloadQrcode}>
                <div className="space-y-1">
                  <Label>小程序 code</Label>
                  <Input
                    value={qrcode.code}
                    onChange={(e) => setQrcode({ ...qrcode, code: e.target.value })}
                    placeholder={items[0]?.code || 'mall'}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label>scene</Label>
                  <Input
                    value={qrcode.scene}
                    onChange={(e) => setQrcode({ ...qrcode, scene: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label>page（可选）</Label>
                  <Input
                    value={qrcode.page}
                    onChange={(e) => setQrcode({ ...qrcode, page: e.target.value })}
                    placeholder="pages/index/index"
                  />
                </div>
                <Button type="submit" className="w-full">
                  下载 PNG
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
