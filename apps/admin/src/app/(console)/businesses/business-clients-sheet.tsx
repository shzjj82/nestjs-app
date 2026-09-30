'use client';

import { useCallback, useEffect, useState } from 'react';
import { Ban, CircleCheck, Plus } from 'lucide-react';
import { toast } from 'sonner';

import { SelectField } from '@/components/select-field';
import { StatusBadge } from '@/components/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { adminFetch } from '@/lib/api';
import type { Business } from '@/lib/businesses';

interface Client {
  id: string;
  appCode: string;
  name: string;
  type: string;
  wechatAppId: string | null;
  alipayAppId: string | null;
  status: number;
}

const TYPES = [
  { value: 'web', label: 'Web' },
  { value: 'wechat_mp', label: '微信小程序' },
  { value: 'alipay_mp', label: '支付宝小程序' },
  { value: 'app', label: 'App' },
];

const EMPTY_FORM = { appCode: '', name: '', type: 'web', wechatAppId: '', alipayAppId: '' };

export function BusinessClientsSheet({
  business,
  onOpenChange,
}: {
  business: Business | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [clients, setClients] = useState<Client[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);

  const load = useCallback(async () => {
    if (!business) return;
    setClients(await adminFetch<Client[]>(`/clients?businessId=${business.id}`));
  }, [business]);

  useEffect(() => {
    setForm(EMPTY_FORM);
    load().catch((err) => toast.error(err instanceof Error ? err.message : '加载失败'));
  }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!business) return;
    try {
      await adminFetch('/clients', {
        method: 'POST',
        body: JSON.stringify({
          businessId: business.id,
          appCode: form.appCode,
          name: form.name,
          type: form.type,
          wechatAppId: form.wechatAppId || undefined,
          alipayAppId: form.alipayAppId || undefined,
        }),
      });
      toast.success('接入端已创建');
      setForm(EMPTY_FORM);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '创建失败');
    }
  }

  async function toggle(client: Client) {
    try {
      await adminFetch(`/clients/${client.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: client.status === 1 ? 0 : 1 }),
      });
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '更新失败');
    }
  }

  return (
    <Sheet open={!!business} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 data-[side=right]:sm:max-w-2xl">
        <SheetHeader className="border-b">
          <SheetTitle>接入端 · {business?.name}</SheetTitle>
          <SheetDescription>
            业务下的 Web / 小程序入口；同类型有多个时，登录需传 clientCode
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 space-y-5 overflow-y-auto p-4">
          {clients.length === 0 ? (
            <p className="text-sm text-muted-foreground">该业务暂无接入端</p>
          ) : (
            <div className="space-y-2">
              {clients.map((client) => {
                const active = client.status === 1;
                return (
                  <div
                    key={client.id}
                    className="flex items-center justify-between gap-3 rounded-lg border p-3"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm">{client.appCode}</span>
                        <Badge variant="outline">
                          {TYPES.find((t) => t.value === client.type)?.label ?? client.type}
                        </Badge>
                        <StatusBadge active={active} activeLabel="启用" />
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {client.name}
                        {client.wechatAppId ? ` · 微信 ${client.wechatAppId}` : ''}
                        {client.alipayAppId ? ` · 支付宝 ${client.alipayAppId}` : ''}
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => toggle(client)}>
                      {active ? <Ban /> : <CircleCheck />}
                      {active ? '停用' : '启用'}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
          <Separator />
          <form className="space-y-4" onSubmit={create}>
            <div className="text-sm font-medium">新建接入端</div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="client-code">clientCode</Label>
                <Input
                  id="client-code"
                  value={form.appCode}
                  onChange={(e) => setForm({ ...form, appCode: e.target.value })}
                  placeholder="blog-web"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="client-name">名称</Label>
                <Input
                  id="client-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
            </div>
            <SelectField
              label="类型"
              value={form.type}
              onChange={(type) => setForm({ ...form, type })}
              options={TYPES}
            />
            {form.type === 'wechat_mp' ? (
              <div className="space-y-2">
                <Label htmlFor="client-wechat">微信 appId / code</Label>
                <Input
                  id="client-wechat"
                  value={form.wechatAppId}
                  onChange={(e) => setForm({ ...form, wechatAppId: e.target.value })}
                  placeholder="指向微信服务已登记的 appId"
                />
              </div>
            ) : null}
            {form.type === 'alipay_mp' ? (
              <div className="space-y-2">
                <Label htmlFor="client-alipay">支付宝 appId</Label>
                <Input
                  id="client-alipay"
                  value={form.alipayAppId}
                  onChange={(e) => setForm({ ...form, alipayAppId: e.target.value })}
                />
              </div>
            ) : null}
            <div className="flex justify-end">
              <Button type="submit">
                <Plus />
                添加接入端
              </Button>
            </div>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
