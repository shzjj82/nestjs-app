'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { adminFetch } from '@/lib/api';
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

interface Permission {
  id: string;
  module: string;
  code: string;
  name: string;
  description: string | null;
  sort: number;
}

export default function PermissionsPage() {
  const [items, setItems] = useState<Permission[]>([]);
  const [form, setForm] = useState({
    module: '用户',
    code: '',
    name: '',
    description: '',
    sort: '10',
  });

  async function load() {
    setItems(await adminFetch<Permission[]>('/permissions'));
  }

  useEffect(() => {
    load().catch((err) => toast.error(err.message));
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    try {
      await adminFetch('/permissions', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          sort: Number(form.sort) || 0,
        }),
      });
      toast.success('已创建功能点');
      setForm({ module: form.module, code: '', name: '', description: '', sort: form.sort });
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '创建失败');
    }
  }

  async function exportExcel() {
    try {
      const res = await fetch('/api/proxy/permissions/export');
      if (!res.ok) throw new Error('导出失败');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'permissions.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '导出失败');
    }
  }

  async function importExcel(file: File | null) {
    if (!file) return;
    const body = new FormData();
    body.append('file', file);
    try {
      const res = await fetch('/api/proxy/permissions/import', {
        method: 'POST',
        body,
      });
      const json = await res.json();
      if (!res.ok || json.success === false) {
        throw new Error(json.message || '导入失败');
      }
      toast.success('导入成功');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '导入失败');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">功能点</h1>
          <p className="text-sm text-muted-foreground">全局权限目录，支持 Excel 导入导出</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportExcel}>
            导出 Excel
          </Button>
          <label className="inline-flex h-10 cursor-pointer items-center rounded-md border px-4 text-sm">
            导入 Excel
            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => importExcel(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>功能点列表</CardTitle>
            <CardDescription>共 {items.length} 项</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>模块</TableHead>
                  <TableHead>编码</TableHead>
                  <TableHead>名称</TableHead>
                  <TableHead>排序</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{p.module}</TableCell>
                    <TableCell className="font-mono text-xs">{p.code}</TableCell>
                    <TableCell>{p.name}</TableCell>
                    <TableCell>{p.sort}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>新建功能点</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={create}>
              <div className="space-y-1">
                <Label>模块</Label>
                <Input
                  value={form.module}
                  onChange={(e) => setForm({ ...form, module: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label>编码</Label>
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
                <Label>排序</Label>
                <Input
                  value={form.sort}
                  onChange={(e) => setForm({ ...form, sort: e.target.value })}
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
