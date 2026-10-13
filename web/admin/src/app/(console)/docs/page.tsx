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
import { hasApi, type Business } from '@/lib/businesses';

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
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [bizCode, setBizCode] = useState('');
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [docOpen, setDocOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_DOC);
  const [catForm, setCatForm] = useState(EMPTY_CAT);
  const [docPage, setDocPage] = useState(1);
  const [docPageSize, setDocPageSize] = useState(20);
  const [docTotal, setDocTotal] = useState(0);

  async function loadBusinesses() {
    const list = (await adminFetch<Business[]>('/businesses')).filter(
      (b) => b.status === 1 && hasApi(b, 'GET /docs/documents'),
    );
    setBusinesses(list);
    if (list.length && !list.find((b) => b.code === bizCode)) {
      setBizCode(list[0].code);
    }
  }

  async function loadDocs(
    code = bizCode,
    page = docPage,
    pageSize = docPageSize,
  ) {
    if (!code) return;
    const qs = new URLSearchParams({
      scope: 'all',
      page: String(page),
      pageSize: String(pageSize),
    });
    const result = await adminFetch<
      | { posts?: DocItem[]; items?: DocItem[]; total?: number; page?: number; pageSize?: number }
      | DocItem[]
    >(`/docs/documents?${qs}`, { bizCode: code });
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
    const cats = await adminFetch<{ categories?: Category[] } | Category[]>('/docs/categories', {
      bizCode: code,
    });
    setCategories(Array.isArray(cats) ? cats : cats.categories ?? []);
  }

  useEffect(() => {
    loadBusinesses().catch((err) => toast.error(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadDocs(bizCode, docPage, docPageSize).catch((err) =>
      toast.error(err instanceof Error ? err.message : '加载失败'),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bizCode, docPage, docPageSize]);

  async function onBizChange(code: string) {
    setBizCode(code);
    setDocPage(1);
  }

  async function createDoc(e: React.FormEvent) {
    e.preventDefault();
    try {
      await adminFetch('/docs/documents', {
        method: 'POST',
        bizCode,
        body: JSON.stringify({
          title: form.title,
          slug: form.slug || undefined,
          body: {
            blocks: form.content
              .split('\n')
              .filter((line) => line.trim())
              .map((text) => ({ type: 'paragraph', data: { text } })),
          },
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
        bizCode,
        body: JSON.stringify({
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

  const bizOptions = businesses.map((b) => ({
    value: b.code,
    label: `${b.name} (${b.code})`,
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
        description="按业务 code 隔离文档与分类（仅列出已开通文档模块的业务）"
        actions={
          <>
            {bizOptions.length > 0 ? (
              <div className="w-48">
                <SelectField
                  label="当前业务"
                  value={bizCode}
                  onChange={onBizChange}
                  options={bizOptions}
                />
              </div>
            ) : null}
            <Button variant="outline" onClick={() => setCatOpen(true)} disabled={!bizCode}>
              <FolderPlus />
              新建分类
            </Button>
            <Button onClick={() => setDocOpen(true)} disabled={!bizCode}>
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
            <DialogDescription>将创建在业务 {bizCode} 下</DialogDescription>
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
            <DialogDescription>将创建在业务 {bizCode} 下</DialogDescription>
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
