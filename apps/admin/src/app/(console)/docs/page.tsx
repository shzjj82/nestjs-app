'use client';

import { useEffect, useMemo, useState } from 'react';
import { DataTable } from '@/components/data-table';
import type { AdminColumnDef } from '@/lib/admin-table-types';
import { FolderPlus, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { adminFetch } from '@/lib/api';
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
import { SelectField } from '@/components/select-field';
import { Textarea } from '@/components/ui/textarea';
interface Client {
  appCode: string;
  name: string;
}

interface DocItem {
  id: string;
  title: string;
  slug: string;
  visibility?: string;
  kind?: string;
  updatedAt?: string;
}

interface Category {
  id: string;
  slug: string;
  name: string;
}

const EMPTY_DOC = { title: '', slug: '', content: '', visibility: 'public' };
const EMPTY_CAT = { name: '', slug: '' };

export default function DocsPage() {
  const [tenants, setTenants] = useState<Client[]>([]);
  const [appCode, setAppCode] = useState('web');
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [docOpen, setDocOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_DOC);
  const [catForm, setCatForm] = useState(EMPTY_CAT);
  const [docPage, setDocPage] = useState(1);
  const [docPageSize, setDocPageSize] = useState(20);
  const [docTotal, setDocTotal] = useState(0);

  async function loadTenants() {
    const clients = await adminFetch<Client[]>('/clients');
    setTenants(clients);
    if (clients.length && !clients.find((c) => c.appCode === appCode)) {
      setAppCode(clients[0].appCode);
    }
  }

  async function loadDocs(
    code = appCode,
    page = docPage,
    pageSize = docPageSize,
  ) {
    const qs = new URLSearchParams({
      appCode: code,
      scope: 'all',
      page: String(page),
      pageSize: String(pageSize),
    });
    const result = await adminFetch<
      | { posts?: DocItem[]; items?: DocItem[]; total?: number; page?: number; pageSize?: number }
      | DocItem[]
    >(`/docs/documents?${qs}`);
    if (Array.isArray(result)) {
      setDocs(result);
      setDocTotal(result.length);
      setDocPage(1);
      setDocPageSize(result.length || pageSize);
    } else {
      const list = result.posts ?? result.items ?? [];
      setDocs(list);
      setDocTotal(result.total ?? list.length);
      if (result.page) setDocPage(result.page);
      if (result.pageSize) setDocPageSize(result.pageSize);
    }
    const cats = await adminFetch<{ categories?: Category[] } | Category[]>(
      `/docs/categories?appCode=${encodeURIComponent(code)}`,
    );
    setCategories(Array.isArray(cats) ? cats : cats.categories ?? []);
  }

  useEffect(() => {
    loadTenants().catch((err) => toast.error(err.message));
  }, []);

  useEffect(() => {
    loadDocs(appCode, docPage, docPageSize).catch((err) =>
      toast.error(err instanceof Error ? err.message : '加载失败'),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appCode, docPage, docPageSize]);

  async function onAppChange(code: string) {
    setAppCode(code);
    setDocPage(1);
  }

  async function createDoc(e: React.FormEvent) {
    e.preventDefault();
    try {
      await adminFetch('/docs/documents', {
        method: 'POST',
        body: JSON.stringify({
          appCode,
          title: form.title,
          slug: form.slug || undefined,
          content: form.content,
          visibility: form.visibility,
          kind: 'article',
        }),
      });
      toast.success('文档已创建');
      setForm(EMPTY_DOC);
      setDocOpen(false);
      await loadDocs();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '创建失败');
    }
  }

  async function createCategory(e: React.FormEvent) {
    e.preventDefault();
    try {
      await adminFetch('/docs/categories', {
        method: 'POST',
        body: JSON.stringify({
          appCode,
          name: catForm.name,
          slug: catForm.slug || undefined,
          kind: 'article',
        }),
      });
      toast.success('分类已创建');
      setCatForm(EMPTY_CAT);
      setCatOpen(false);
      await loadDocs();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '创建失败');
    }
  }

  const tenantOptions = tenants.map((t) => ({
    value: t.appCode,
    label: `${t.name} (${t.appCode})`,
  }));

  const docColumns = useMemo<AdminColumnDef<DocItem>[]>(
    () => [
      {
        accessorKey: 'title',
        header: '标题',
        meta: { label: '标题' },
      },
      {
        accessorKey: 'slug',
        header: 'slug',
        meta: { label: 'slug' },
        cell: ({ row }) => <span className="font-mono text-xs">{row.original.slug}</span>,
      },
      {
        accessorKey: 'visibility',
        header: '可见性',
        meta: { label: '可见性' },
        cell: ({ row }) => (
          <Badge variant="outline">{row.original.visibility || '—'}</Badge>
        ),
      },
    ],
    [],
  );

  const categoryColumns = useMemo<AdminColumnDef<Category>[]>(
    () => [
      {
        accessorKey: 'name',
        header: '名称',
        meta: { label: '名称' },
      },
      {
        accessorKey: 'slug',
        header: 'slug',
        meta: { label: 'slug' },
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">{row.original.slug}</span>
        ),
      },
    ],
    [],
  );

  return (
    <>
      <PageHeader
        title="文档空间"
        description="按租户 appCode 隔离文档与分类"
        actions={
          <>
            {tenantOptions.length > 0 ? (
              <div className="w-48">
                <SelectField
                  label="当前租户"
                  value={appCode}
                  onChange={onAppChange}
                  options={tenantOptions}
                />
              </div>
            ) : null}
            <Button variant="outline" onClick={() => setCatOpen(true)}>
              <FolderPlus />
              新建分类
            </Button>
            <Button onClick={() => setDocOpen(true)}>
              <Plus />
              新建文档
            </Button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
            <DataTable
              columns={docColumns}
              data={docs}
              emptyMessage="暂无文档"
              pagination={{
                mode: 'server',
                page: docPage,
                pageSize: docPageSize,
                total: docTotal,
                onChange: ({ page, pageSize }) => {
                  setDocPage(page);
                  setDocPageSize(pageSize);
                },
              }}
            />
        </div>

          <DataTable
            columns={categoryColumns}
            data={categories}
            emptyMessage="暂无分类"
            enableRowSelection={false}
          />
      </div>

      <Dialog open={docOpen} onOpenChange={setDocOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>新建文档</DialogTitle>
            <DialogDescription>将创建在租户 {appCode} 下</DialogDescription>
          </DialogHeader>
          <form id="doc-create" className="space-y-4" onSubmit={createDoc}>
            <div className="space-y-2">
              <Label>标题</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>slug（可选）</Label>
              <Input
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>内容</Label>
              <Textarea
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                rows={8}
              />
            </div>
          </form>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDocOpen(false)}>
              取消
            </Button>
            <Button type="submit" form="doc-create">
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={catOpen} onOpenChange={setCatOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>新建分类</DialogTitle>
            <DialogDescription>将创建在租户 {appCode} 下</DialogDescription>
          </DialogHeader>
          <form id="cat-create" className="space-y-4" onSubmit={createCategory}>
            <div className="space-y-2">
              <Label>分类名称</Label>
              <Input
                value={catForm.name}
                onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>slug（可选）</Label>
              <Input
                value={catForm.slug}
                onChange={(e) => setCatForm({ ...catForm, slug: e.target.value })}
              />
            </div>
          </form>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCatOpen(false)}>
              取消
            </Button>
            <Button type="submit" form="cat-create">
              添加分类
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
