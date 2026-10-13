'use client';

import { useEffect, useMemo, useState } from 'react';
import { Download, FileUp, Plus } from 'lucide-react';
import { toast } from 'sonner';

import { ConsolePage } from '@/components/console-page';
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { adminFetch, readApiResponse } from '@/lib/api';
import {
  featureScopeLabel,
  flattenApiCatalog,
  groupPermissions,
  type BizApiItem,
  type BizServiceCatalogItem,
  type Permission,
} from '@/lib/businesses';

type ScopeFilter = 'platform' | 'business';

const MODULE_OPTIONS = [
  '用户中心',
  '业务租户',
  '接入端',
  '角色权限',
  '功能点目录',
  '微信小程序',
  '认证',
  '团队',
  '通用订单',
  '文档',
  '上传',
  '微信业务',
  '回收·基础',
  '回收·目录',
  '回收·门店',
  '回收·订单',
  '回收·审批',
  '智能助手',
];

const DEFAULT_FORM = {
  scope: 'platform' as 'platform' | 'business',
  module: '用户中心',
  code: '',
  name: '',
  description: '',
  sort: '10',
  apis: '',
};

async function downloadProxy(path: string, fallbackName: string) {
  const res = await fetch(`/api/proxy${path}`);
  if (!res.ok) throw new Error((await readApiResponse(res)).message);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fallbackName;
  a.click();
  URL.revokeObjectURL(url);
}

function visiblePermissions(list: Permission[]) {
  return list.filter((item) => !item.adminOnly);
}

export function PermissionsPageClient({ initialItems }: { initialItems: Permission[] }) {
  const [items, setItems] = useState<Permission[]>(() => visiblePermissions(initialItems));
  const [keyword, setKeyword] = useState('');
  const [scope, setScope] = useState<ScopeFilter>('platform');
  const [createOpen, setCreateOpen] = useState(false);
  const [detail, setDetail] = useState<Permission | null>(null);
  const [apiIndex, setApiIndex] = useState<Map<string, BizApiItem>>(new Map());
  const [form, setForm] = useState(DEFAULT_FORM);

  useEffect(() => {
    adminFetch<BizServiceCatalogItem[]>('/biz-modules?scope=all')
      .then((catalog) => setApiIndex(flattenApiCatalog(catalog)))
      .catch(() => setApiIndex(new Map()));
  }, []);

  async function load() {
    setItems(visiblePermissions(await adminFetch<Permission[]>('/permissions')));
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    try {
      const apis = form.apis
        .split('\n')
        .map((line) => line.trim().replace(/\s+/g, ' '))
        .filter(Boolean);
      await adminFetch('/permissions', {
        method: 'POST',
        body: JSON.stringify({
          scope: form.scope,
          module: form.module,
          code: form.code,
          name: form.name,
          description: form.description,
          sort: Number(form.sort) || 0,
          apis,
        }),
      });
      toast.success('已创建功能点');
      setForm({ ...DEFAULT_FORM, scope: form.scope, module: form.module, sort: form.sort });
      setCreateOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '创建失败');
    }
  }

  async function importExcel(file: File | null) {
    if (!file) return;
    const body = new FormData();
    body.append('file', file);
    try {
      const result = await adminFetch<{ imported: number; apiBindings?: number }>(
        '/permissions/import',
        { method: 'POST', body },
      );
      toast.success(
        `导入成功：${result.imported} 个功能点` +
          (result.apiBindings != null ? ` · ${result.apiBindings} 条接口绑定` : ''),
      );
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '导入失败');
    }
  }

  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return items.filter((item) => {
      if ((item.scope ?? 'platform') !== scope) return false;
      if (!q) return true;
      const apis = (item.apis ?? []).join(' ').toLowerCase();
      return (
        item.name.toLowerCase().includes(q) ||
        item.code.toLowerCase().includes(q) ||
        item.module.toLowerCase().includes(q) ||
        (item.description ?? '').toLowerCase().includes(q) ||
        apis.includes(q)
      );
    });
  }, [items, keyword, scope]);

  const groups = useMemo(() => groupPermissions(filtered), [filtered]);
  const platformCount = items.filter((i) => (i.scope ?? 'platform') === 'platform').length;
  const businessCount = items.filter((i) => i.scope === 'business').length;
  const scopeHint =
    scope === 'platform'
      ? '在「角色」页勾选，控制管理后台谁能做什么。'
      : '在「业务」页开通，控制某个租户能调用哪些接口。';

  return (
    <ConsolePage>
      <PageHeader
        title="功能点"
        description="一个功能点绑定多条接口。按用途分开维护：角色权限给后台角色；开通模块给租户白名单。"
        actions={
          <>
            <Button
              variant="outline"
              onClick={() =>
                downloadProxy('/permissions/template', 'permissions-template.xlsx').catch((err) =>
                  toast.error(err instanceof Error ? err.message : '下载失败'),
                )
              }
            >
              <Download />
              下载模版
            </Button>
            <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-muted/50">
              <FileUp className="size-4" />
              上传模版
              <input
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  void importExcel(e.target.files?.[0] ?? null);
                  e.target.value = '';
                }}
              />
            </label>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus />
              新建功能点
            </Button>
          </>
        }
      />

      <div className="space-y-2">
        <Tabs value={scope} onValueChange={(v) => setScope(v as ScopeFilter)}>
          <TabsList>
            <TabsTrigger value="platform">角色权限 {platformCount}</TabsTrigger>
            <TabsTrigger value="business">开通模块 {businessCount}</TabsTrigger>
          </TabsList>
        </Tabs>
        <p className="text-sm text-muted-foreground">{scopeHint}</p>
        <div className="flex flex-wrap items-center gap-3">
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索分类 / 名称 / 编码 / 接口..."
            className="max-w-sm"
          />
          <span className="text-sm text-muted-foreground">
            共 {filtered.length} 项 · {groups.length} 个分类
          </span>
        </div>
      </div>

      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">没有匹配的功能点</p>
      ) : (
        <div className="space-y-4 pb-4">
          {groups.map(([module, list]) => (
            <section key={module} className="overflow-hidden rounded-xl border">
              <div className="flex items-center justify-between gap-3 border-b bg-muted/40 px-4 py-3">
                <div>
                  <h2 className="text-sm font-semibold">{module}</h2>
                  <p className="text-xs text-muted-foreground">{list.length} 个功能点</p>
                </div>
                <Badge variant="secondary">{module}</Badge>
              </div>
              <ul className="divide-y">
                {list.map((item) => {
                  const apiCount = item.apis?.length ?? 0;
                  return (
                    <li
                      key={item.id}
                      className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{item.name}</span>
                          <Badge variant="outline">{featureScopeLabel(item.scope)}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {apiCount > 0 ? `${apiCount} 个接口` : '未绑定接口'}
                          </span>
                        </div>
                        {item.description ? (
                          <p className="text-sm text-muted-foreground">{item.description}</p>
                        ) : null}
                        <code className="font-mono text-xs text-muted-foreground">{item.code}</code>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="shrink-0"
                        onClick={() => setDetail(item)}
                      >
                        详情
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      <Dialog open={!!detail} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="sm:max-w-lg">
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
                    <li key={key} className="space-y-1 px-3 py-2.5">
                      <div className="text-sm font-medium">{meta?.name ?? key}</div>
                      {meta?.description ? (
                        <p className="text-xs text-muted-foreground">{meta.description}</p>
                      ) : null}
                      <code className="font-mono text-[11px] text-muted-foreground">{key}</code>
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

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>新建功能点</DialogTitle>
            <DialogDescription>
              选用途：角色权限出现在角色勾选里；开通模块出现在业务开通侧栏。接口每行一个，格式 METHOD /path
            </DialogDescription>
          </DialogHeader>
          <form id="perm-create" className="space-y-4" onSubmit={create}>
            <div className="space-y-2">
              <Label htmlFor="perm-scope">用途</Label>
              <select
                id="perm-scope"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={form.scope}
                onChange={(e) =>
                  setForm({ ...form, scope: e.target.value as 'platform' | 'business' })
                }
              >
                <option value="platform">角色权限（给后台角色）</option>
                <option value="business">开通模块（给租户白名单）</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="perm-module">分类</Label>
              <Input
                id="perm-module"
                list="perm-module-options"
                value={form.module}
                onChange={(e) => setForm({ ...form, module: e.target.value })}
                placeholder="例如 用户中心"
                required
              />
              <datalist id="perm-module-options">
                {MODULE_OPTIONS.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </div>
            <div className="space-y-2">
              <Label htmlFor="perm-code">编码</Label>
              <Input
                id="perm-code"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="例如 user.query"
                className="font-mono"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="perm-name">名称</Label>
              <Input
                id="perm-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="perm-desc">说明</Label>
              <Input
                id="perm-desc"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="perm-apis">接口绑定</Label>
              <textarea
                id="perm-apis"
                value={form.apis}
                onChange={(e) => setForm({ ...form, apis: e.target.value })}
                placeholder={'GET /users\nGET /users/:id'}
                className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="perm-sort">排序</Label>
              <Input
                id="perm-sort"
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
    </ConsolePage>
  );
}
