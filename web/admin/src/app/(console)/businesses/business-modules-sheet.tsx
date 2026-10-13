'use client';

import { useEffect, useMemo, useState } from 'react';
import { CircleAlert, CircleCheck } from 'lucide-react';
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
import {
  flattenApiCatalog,
  groupPermissions,
  type BizApiItem,
  type BizServiceCatalogItem,
  type Business,
  type Permission,
} from '@/lib/businesses';

type Filter = 'all' | 'opened' | 'pending';
type ConfirmAction = 'open' | 'close' | null;

function featureOpenState(feature: Permission, opened: Set<string>) {
  const apis = feature.apis ?? [];
  if (!apis.length) return 'none' as const;
  const hit = apis.filter((api) => opened.has(api)).length;
  if (hit === 0) return 'none' as const;
  if (hit === apis.length) return 'all' as const;
  return 'partial' as const;
}

function FeatureGroup({
  module,
  features,
  opened,
  selected,
  selectable,
  onToggle,
  onToggleAll,
  onDetail,
}: {
  module: string;
  features: Permission[];
  opened: Set<string>;
  selected: Set<string>;
  selectable: boolean;
  onToggle: (code: string, next: boolean) => void;
  onToggleAll: (next: boolean) => void;
  onDetail: (feature: Permission) => void;
}) {
  const selectedCount = features.filter((f) => selected.has(f.code)).length;
  const allSelected = features.length > 0 && selectedCount === features.length;
  const someSelected = selectedCount > 0 && !allSelected;
  const openCount = features.filter((f) => featureOpenState(f, opened) === 'all').length;

  return (
    <Card size="sm" className="gap-0 py-0">
      <CardHeader className="border-b py-3">
        <div className="flex min-w-0 items-center gap-2">
          {selectable ? (
            <Checkbox
              checked={allSelected}
              indeterminate={someSelected}
              onCheckedChange={(checked) => onToggleAll(checked === true)}
              aria-label={`全选 ${module}`}
            />
          ) : null}
          <CardTitle>{module}</CardTitle>
        </div>
        <CardAction>
          <span className="text-xs text-muted-foreground">
            {selectable
              ? `已选 ${selectedCount}/${features.length}`
              : `${openCount}/${features.length} 已开通`}
          </span>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-2 py-3">
        {features.map((feature) => {
          const id = `feature-${feature.code}`;
          const state = featureOpenState(feature, opened);
          const isPicked = selected.has(feature.code);
          const apiCount = feature.apis?.length ?? 0;
          return (
            <div
              key={feature.code}
              className={
                selectable
                  ? `flex items-start gap-2.5 rounded-lg border p-3 transition-colors hover:bg-muted/50 ${isPicked ? 'border-primary/40 bg-primary/5' : ''}`
                  : 'flex items-start gap-2.5 rounded-lg border bg-muted/20 p-3'
              }
            >
              {selectable ? (
                <Checkbox
                  id={id}
                  className="mt-0.5"
                  checked={isPicked}
                  onCheckedChange={(next) => onToggle(feature.code, next === true)}
                />
              ) : null}
              <Label
                htmlFor={selectable ? id : undefined}
                className={
                  selectable
                    ? 'min-w-0 flex-1 cursor-pointer space-y-1 font-normal'
                    : 'min-w-0 flex-1 space-y-1 font-normal'
                }
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium leading-5">{feature.name}</span>
                  <Badge
                    variant={state === 'all' ? 'secondary' : 'outline'}
                    className="shrink-0"
                  >
                    {state === 'all' ? '已开通' : state === 'partial' ? '部分' : '未开通'}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {apiCount > 0 ? `${apiCount} 个接口` : '未绑定接口'}
                  </span>
                </div>
                {feature.description ? (
                  <p className="line-clamp-2 text-xs text-muted-foreground">{feature.description}</p>
                ) : null}
                <code className="font-mono text-[11px] text-muted-foreground">{feature.code}</code>
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onDetail(feature);
                }}
              >
                详情
              </Button>
            </div>
          );
        })}
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
  const [features, setFeatures] = useState<Permission[] | null>(null);
  const [apis, setApis] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [shown, setShown] = useState<Business | null>(business);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState<ConfirmAction>(null);
  const [detail, setDetail] = useState<Permission | null>(null);
  const [apiIndex, setApiIndex] = useState<Map<string, BizApiItem>>(new Map());
  const opened = useMemo(() => new Set(apis), [apis]);
  const picked = useMemo(() => new Set(selected), [selected]);
  const selectable = filter !== 'all';
  const byCode = useMemo(
    () => new Map((features ?? []).map((item) => [item.code, item])),
    [features],
  );

  useEffect(() => {
    if (!business) return;
    setShown(business);
    setApis(business.apis);
    setSelected([]);
    setFilter('all');
    setConfirming(null);
  }, [business]);

  useEffect(() => {
    if (!business || features) return;
    Promise.all([
      adminFetch<Permission[]>('/permissions?scope=business'),
      adminFetch<BizServiceCatalogItem[]>('/biz-modules?scope=business'),
    ])
      .then(([list, catalog]) => {
        setFeatures(list);
        setApiIndex(flattenApiCatalog(catalog));
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : '加载功能点失败'));
  }, [business, features]);

  const visible = useMemo(() => {
    const list = features ?? [];
    return list.filter((feature) => {
      const state = featureOpenState(feature, opened);
      if (filter === 'opened') return state === 'all' || state === 'partial';
      if (filter === 'pending') return state !== 'all';
      return true;
    });
  }, [features, filter, opened]);

  const groups = groupPermissions(visible);
  const total = features?.length ?? 0;
  const openedCount =
    features?.filter((f) => featureOpenState(f, opened) === 'all').length ?? 0;
  const pendingCount = total - openedCount;
  const count = selected.length;

  function toggle(code: string, next: boolean) {
    setSelected((current) =>
      next ? (current.includes(code) ? current : [...current, code]) : current.filter((item) => item !== code),
    );
  }

  function expandCodes(codes: string[]): string[] {
    return [...new Set(codes.flatMap((code) => byCode.get(code)?.apis ?? []))];
  }

  async function apply() {
    if (!shown || !confirming || selected.length === 0) return;
    const keys = expandCodes(selected);
    if (!keys.length) {
      toast.error('所选功能点尚未绑定接口');
      return;
    }
    const next =
      confirming === 'open'
        ? [...new Set([...apis, ...keys])]
        : apis.filter((key) => !keys.includes(key));
    setBusy(true);
    try {
      await adminFetch(`/businesses/${shown.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ apis: next }),
      });
      setApis(next);
      setSelected([]);
      setConfirming(null);
      toast.success(confirming === 'open' ? `已开通 ${count} 个功能点` : `已取消开通 ${count} 个功能点`);
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
              开通功能点 · <span className="font-mono">{shown?.code}</span>
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
            <div className="shrink-0 space-y-2 border-b px-4 py-3">
              <TabsList>
                <TabsTrigger value="all">全部 {total}</TabsTrigger>
                <TabsTrigger value="opened">已开通 {openedCount}</TabsTrigger>
                <TabsTrigger value="pending">未开通 {pendingCount}</TabsTrigger>
              </TabsList>
              <p className="text-xs text-muted-foreground">
                按功能点开通；每个功能点会展开为多条网关接口写入业务白名单。
              </p>
            </div>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
              {!features ? (
                <p className="text-sm text-muted-foreground">加载中…</p>
              ) : groups.length ? (
                groups.map(([module, list]) => (
                  <FeatureGroup
                    key={module}
                    module={module}
                    features={list}
                    opened={opened}
                    selected={picked}
                    selectable={selectable}
                    onDetail={setDetail}
                    onToggle={toggle}
                    onToggleAll={(next) => {
                      const codes = list.map((item) => item.code);
                      setSelected((current) =>
                        next
                          ? [...new Set([...current, ...codes])]
                          : current.filter((code) => !codes.includes(code)),
                      );
                    }}
                  />
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  {filter === 'pending' ? '所有功能点均已开通' : '尚未开通任何功能点'}
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

      <Dialog open={!!detail} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="z-[80] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{detail?.name}</DialogTitle>
            <DialogDescription className="space-y-1">
              <span className="block font-mono text-xs">{detail?.code}</span>
              {detail?.description ? <span className="block">{detail.description}</span> : null}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">绑定接口</span>
              <span className="tabular-nums">{detail?.apis?.length ?? 0} 条</span>
            </div>
            {(detail?.apis ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">尚未绑定接口</p>
            ) : (
              <ul className="max-h-72 divide-y overflow-y-auto rounded-lg border">
                {detail!.apis!.map((key) => {
                  const meta = apiIndex.get(key);
                  return (
                    <li key={key} className="flex items-start justify-between gap-3 px-3 py-2.5">
                      <div className="min-w-0 space-y-1">
                        <div className="text-sm font-medium">{meta?.name ?? key}</div>
                        {meta?.description ? (
                          <p className="text-xs text-muted-foreground">{meta.description}</p>
                        ) : null}
                        <code className="font-mono text-[11px] text-muted-foreground">{key}</code>
                      </div>
                      <Badge
                        variant={opened.has(key) ? 'secondary' : 'outline'}
                        className="shrink-0"
                      >
                        {opened.has(key) ? '已开通' : '未开通'}
                      </Badge>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDetail(null)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                <CircleAlert className="size-6" />
              ) : (
                <CircleCheck className="size-6" />
              )}
            </div>
            <DialogTitle>{confirming === 'open' ? '确认开通这些功能点？' : '确认取消开通？'}</DialogTitle>
            <DialogDescription>
              {confirming === 'open'
                ? `已选 ${count} 个功能点，将展开为对应接口并立即生效。`
                : `已选 ${count} 个功能点，将移除其绑定接口，该业务将无法再调用。`}
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
