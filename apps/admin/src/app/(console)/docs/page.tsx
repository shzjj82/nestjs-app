'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { adminFetch } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

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

export default function DocsPage() {
  const [tenants, setTenants] = useState<Client[]>([]);
  const [appCode, setAppCode] = useState('web');
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState({
    title: '',
    slug: '',
    content: '',
    visibility: 'public',
  });
  const [catForm, setCatForm] = useState({ name: '', slug: '' });

  async function loadTenants() {
    const clients = await adminFetch<Client[]>('/clients');
    setTenants(clients);
    if (clients.length && !clients.find((c) => c.appCode === appCode)) {
      setAppCode(clients[0].appCode);
    }
  }

  async function loadDocs(code = appCode) {
    const qs = new URLSearchParams({
      appCode: code,
      scope: 'all',
      page: '1',
      pageSize: '50',
    });
    const result = await adminFetch<{ posts?: DocItem[]; items?: DocItem[] } | DocItem[]>(
      `/docs/documents?${qs}`,
    );
    if (Array.isArray(result)) {
      setDocs(result);
    } else {
      setDocs(result.posts ?? result.items ?? []);
    }
    const cats = await adminFetch<{ categories?: Category[] } | Category[]>(
      `/docs/categories?appCode=${encodeURIComponent(code)}`,
    );
    setCategories(Array.isArray(cats) ? cats : cats.categories ?? []);
  }

  useEffect(() => {
    loadTenants()
      .then(() => loadDocs())
      .catch((err) => toast.error(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onAppChange(code: string) {
    setAppCode(code);
    try {
      await loadDocs(code);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '加载失败');
    }
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
      setForm({ title: '', slug: '', content: '', visibility: 'public' });
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
      setCatForm({ name: '', slug: '' });
      await loadDocs();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '创建失败');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">文档空间</h1>
          <p className="text-sm text-muted-foreground">按租户 appCode 隔离</p>
        </div>
        <div className="space-y-1">
          <Label>当前租户</Label>
          <select
            className="flex h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={appCode}
            onChange={(e) => onAppChange(e.target.value)}
          >
            {tenants.map((t) => (
              <option key={t.appCode} value={t.appCode}>
                {t.name} ({t.appCode})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>文档列表</CardTitle>
            <CardDescription>共 {docs.length} 篇</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>标题</TableHead>
                  <TableHead>slug</TableHead>
                  <TableHead>可见性</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {docs.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>{d.title}</TableCell>
                    <TableCell className="font-mono text-xs">{d.slug}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{d.visibility || '—'}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>新建文档</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-3" onSubmit={createDoc}>
                <div className="space-y-1">
                  <Label>标题</Label>
                  <Input
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label>slug（可选）</Label>
                  <Input
                    value={form.slug}
                    onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label>内容</Label>
                  <Textarea
                    value={form.content}
                    onChange={(e) => setForm({ ...form, content: e.target.value })}
                    rows={6}
                  />
                </div>
                <Button type="submit" className="w-full">
                  创建
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>分类</CardTitle>
              <CardDescription>共 {categories.length} 个</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="space-y-1 text-sm">
                {categories.map((c) => (
                  <li key={c.id}>
                    {c.name}{' '}
                    <span className="font-mono text-xs text-muted-foreground">{c.slug}</span>
                  </li>
                ))}
              </ul>
              <form className="space-y-2" onSubmit={createCategory}>
                <Input
                  placeholder="分类名称"
                  value={catForm.name}
                  onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
                  required
                />
                <Input
                  placeholder="slug（可选）"
                  value={catForm.slug}
                  onChange={(e) => setCatForm({ ...catForm, slug: e.target.value })}
                />
                <Button type="submit" size="sm" className="w-full">
                  添加分类
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
