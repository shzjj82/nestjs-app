'use client';

import { useEffect, useMemo, useState } from 'react';
import { Attention, CheckOne } from '@icon-park/react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { adminFetch } from '@/lib/api';
import type { BizApiItem, BizServiceCatalogItem, Business } from '@/lib/businesses';

type Filter = 'all' | 'opened' | 'pending';
type ConfirmAction = 'open' | 'close' | null;

function ServiceGroup({
  service,
  apis,
  opened,
  selected,
  selectable,
  onToggle,
  onToggleAll,
}: {
  service: BizServiceCatalogItem;
  apis: BizApiItem[];
  opened: Set<string>;
  selected: Set<string>;
  selectable: boolean;
  onToggle: (key: string, next: boolean) => void;
  onToggleAll: (next: boolean) => void;
}) {
  const selectedCount = apis.filter((api) => selected.has(api.key)).length;
  const allSelected = apis.length > 0 && selectedCount === apis.length;
  const someSelected = selectedCount > 0 && !allSelected;
  const openCount = apis.filter((api) => opened.has(api.key)).length;

  return (
    <Card size="sm" className="gap-0 py-0">
      <CardHeader className="border-b py-3">
        <div className="flex min-w-0 items-center gap-2">
          {selectable ? (
            <Checkbox
              checked={allSelected ? true : someSelected ? 'indeterminate' : false}
              onCheckedChange={(checked) => onToggleAll(checked === true)}
              aria-label={`全选 ${service.label}`}
            />
          ) : null}
          <CardTitle>{service.label}</CardTitle>
          <span className="font-mono text-xs text-muted-foreground">{service.service}</span>
          {service.online ? null : <Badge variant="destructive">服务离线</Badge>}
        </div>
        <CardAction>
          <span className="text-xs text-muted-foreground">
            {selectable ? `已选 ${selectedCount}/${apis.length}` : `${openCount}/${apis.length} 已开通`}
          </span>
        </CardAction>
      </CardHeader>
      <CardContent className="py-3">
        <div className="grid gap-2 sm:grid-cols-2">
          {apis.map((api) => {
            const id = `${service.service}-${api.key}`;
            const isOpen = opened.has(api.key);
            const isPicked = selected.has(api.key);
            return (
              <Label
                key={api.key}
                htmlFor={selectable ? id : undefined}
                className={
                  selectable
                    ? `flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 font-normal transition-colors hover:bg-muted/50 ${isPicked ? 'border-primary/40 bg-primary/5' : ''}`
                    : 'flex items-start gap-2.5 rounded-lg border bg-muted/20 p-3 font-normal'
                }
              >
                {selectable ? (
                  <Checkbox
                    id={id}
                    className="mt-0.5"
                    checked={isPicked}
                    onCheckedChange={(next) => onToggle(api.key, next === true)}
                  />
                ) : null}
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm leading-5">{api.name}</span>
                    <Badge variant={isOpen ? 'secondary' : 'outline'} className="shrink-0">
                      {isOpen ? '已开通' : '未开通'}
                    </Badge>
                  </div>
                  {api.description ? (
                    <p className="line-clamp-2 text-xs text-muted-foreground">{api.description}</p>
                  ) : null}
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Badge variant="outline" className="font-mono">
                      {api.method}
                    </Badge>
                    <span className="truncate font-mono">{api.path}</span>
                  </div>
                </div>
              </Label>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export function BusinessModulesSheet({
  business,
  onOpenChange,
  onSaved,
}: {
  business: Business | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [catalog, setCatalog] = useState<BizServiceCatalogItem[] | null>(null);
  const [apis, setApis] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [shown, setShown] = useState<Business | null>(business);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState<ConfirmAction>(null);
  const opened = useMemo(() => new Set(apis), [apis]);
  const picked = useMemo(() => new Set(selected), [selected]);
  const selectable = filter !== 'all';

  useEffect(() => {
    if (!business) return;
    setShown(business);
    setApis(business.apis);
    setSelected([]);
    setFilter('all');
    setConfirming(null);
  }, [business]);

  useEffect(() => {
    if (!business || catalog) return;
    adminFetch<BizServiceCatalogItem[]>('/biz-modules')
      .then(setCatalog)
      .catch((err) => toast.error(err instanceof Error ? err.message : '加载接口失败'));
  }, [business, catalog]);

  const groups = (catalog ?? [])
    .map((service) => ({
      service,
      apis: service.apis.filter((api) => {
        const isOpened = opened.has(api.key);
        if (filter === 'opened') return isOpened;
        if (filter === 'pending') return !isOpened;
        return true;
      }),
    }))
    .filter((group) => group.apis.length > 0);

  const total = catalog?.reduce((n, s) => n + s.apis.length, 0) ?? 0;
  const openedCount = catalog?.reduce((n, s) => n + s.apis.filter((a) => opened.has(a.key)).length, 0) ?? 0;
  const pendingCount = total - openedCount;
  const count = selected.length;

  function toggle(key: string, next: boolean) {
    setSelected((current) =>
      next ? (current.includes(key) ? current : [...current, key]) : current.filter((item) => item !== key),
    );
  }

  async function apply() {
    if (!shown || !confirming || selected.length === 0) return;
    const next =
      confirming === 'open'
        ? [...new Set([...apis, ...selected])]
        : apis.filter((key) => !selected.includes(key));
    setBusy(true);
    try {
      await adminFetch(`/businesses/${shown.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ apis: next }),
      });
      setApis(next);
      setSelected([]);
      setConfirming(null);
      toast.success(confirming === 'open' ? `已开通 ${count} 个接口` : `已取消开通 ${count} 个接口`);
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '更新失败');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
    <Sheet open={!!business} onOpenChange={onOpenChange}>
      <SheetContent className="w-[min(72rem,92vw)] gap-0 data-[side=right]:sm:max-w-[min(72rem,92vw)]">
        <SheetHeader className="border-b">
          <SheetTitle>
            开通模块 · <span className="font-mono">{shown?.code}</span>
          </SheetTitle>
        </SheetHeader>
        <Tabs
          value={filter}
          onValueChange={(value) => {
            setFilter(value as Filter);
            setSelected([]);
          }}
          className="min-h-0 flex-1 gap-0"
        >
          <div className="shrink-0 border-b px-4 py-3">
            <TabsList>
              <TabsTrigger value="all">全部 {total}</TabsTrigger>
              <TabsTrigger value="opened">已开通 {openedCount}</TabsTrigger>
              <TabsTrigger value="pending">未开通 {pendingCount}</TabsTrigger>
            </TabsList>
          </div>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
            {!catalog ? (
              <p className="text-sm text-muted-foreground">加载中…</p>
            ) : groups.length ? (
              groups.map(({ service, apis: groupApis }) => (
                <ServiceGroup
                  key={service.service}
                  service={service}
                  apis={groupApis}
                  opened={opened}
                  selected={picked}
                  selectable={selectable}
                  onToggle={toggle}
                  onToggleAll={(next) => {
                    const keys = groupApis.map((api) => api.key);
                    setSelected((current) =>
                      next
                        ? [...new Set([...current, ...keys])]
                        : current.filter((key) => !keys.includes(key)),
                    );
                  }}
                />
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                {filter === 'pending' ? '所有接口均已开通' : '尚未开通任何接口'}
              </p>
            )}
          </div>
        </Tabs>
        {filter === 'pending' ? (
          <SheetFooter className="flex-row justify-end border-t">
            <Button type="button" disabled={busy || count === 0} onClick={() => setConfirming('open')}>
              确认开通{count ? ` ${count}` : ''}
            </Button>
          </SheetFooter>
        ) : null}
        {filter === 'opened' ? (
          <SheetFooter className="flex-row justify-end border-t">
            <Button
              type="button"
              variant="outline"
              disabled={busy || count === 0}
              onClick={() => setConfirming('close')}
            >
              取消开通{count ? ` ${count}` : ''}
            </Button>
          </SheetFooter>
        ) : null}
      </SheetContent>

    </Sheet>

      <Dialog open={!!confirming} onOpenChange={(open) => !open && !busy && setConfirming(null)}>
        <DialogContent
          showCloseButton={false}
          overlayClassName="z-[80] bg-black/30 duration-300"
          className="z-[80] gap-5 p-6 shadow-xl duration-300 sm:max-w-md data-open:slide-in-from-bottom-3 data-open:zoom-in-95 data-closed:slide-out-to-bottom-2 data-closed:zoom-out-95"
        >
          <DialogHeader className="items-center text-center sm:text-center">
            <div
              className={
                confirming === 'close'
                  ? 'mb-1 flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive'
                  : 'mb-1 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary'
              }
            >
              {confirming === 'close' ? (
                <Attention theme="outline" size={24} fill="currentColor" />
              ) : (
                <CheckOne theme="outline" size={24} fill="currentColor" />
              )}
            </div>
            <DialogTitle>{confirming === 'open' ? '确认开通这些接口？' : '确认取消开通？'}</DialogTitle>
            <DialogDescription>
              {confirming === 'open'
                ? `已选 ${count} 个未开通接口，确认后立即生效。`
                : `已选 ${count} 个已开通接口，取消后该业务将无法再调用。`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="-mx-6 -mb-6">
            <Button type="button" variant="outline" disabled={busy} onClick={() => setConfirming(null)}>
              再想想
            </Button>
            <Button
              type="button"
              variant={confirming === 'close' ? 'destructive' : 'default'}
              disabled={busy}
              onClick={() => apply()}
            >
              {busy ? '处理中…' : confirming === 'open' ? '确认开通' : '确认取消'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
