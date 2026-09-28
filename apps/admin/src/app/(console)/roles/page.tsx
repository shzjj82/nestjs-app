'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { adminFetch } from '@/lib/api';
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

interface Role {
  id: string;
  code: string;
  name: string;
  description: string | null;
  permissionIds: string[];
  permissionCodes: string[];
}

interface Permission {
  id: string;
  code: string;
  name: string;
  module: string;
}

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [selected, setSelected] = useState<Role | null>(null);
  const [permIds, setPermIds] = useState<string[]>([]);
  const [form, setForm] = useState({ code: '', name: '', description: '' });

  async function load() {
    const [r, p] = await Promise.all([
      adminFetch<Role[]>('/roles'),
      adminFetch<Permission[]>('/permissions'),
    ]);
    setRoles(r);
    setPermissions(p);
  }

  useEffect(() => {
    load().catch((err) => toast.error(err.message));
  }, []);

  function selectRole(role: Role) {
    setSelected(role);
    setPermIds(role.permissionIds ?? []);
  }

  async function createRole(e: React.FormEvent) {
    e.preventDefault();
    try {
      await adminFetch('/roles', { method: 'POST', body: JSON.stringify(form) });
      toast.success('角色已创建');
      setForm({ code: '', name: '', description: '' });
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '创建失败');
    }
  }

  async function savePermissions() {
    if (!selected) return;
    try {
      await adminFetch(`/roles/${selected.id}/permissions`, {
        method: 'PUT',
        body: JSON.stringify({ permissionIds: permIds }),
      });
      toast.success('权限已更新');
      await load();
      const refreshed = await adminFetch<Role[]>('/roles');
      const next = refreshed.find((r) => r.id === selected.id);
      if (next) selectRole(next);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '保存失败');
    }
  }

  const grouped = permissions.reduce<Record<string, Permission[]>>((acc, item) => {
    (acc[item.module] ||= []).push(item);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">角色权限组</h1>
        <p className="text-sm text-muted-foreground">维护角色并勾选功能点</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>角色列表</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>编码</TableHead>
                  <TableHead>名称</TableHead>
                  <TableHead>功能点</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {roles.map((role) => (
                  <TableRow key={role.id}>
                    <TableCell className="font-mono text-xs">{role.code}</TableCell>
                    <TableCell>{role.name}</TableCell>
                    <TableCell>{role.permissionCodes?.length ?? 0}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={() => selectRole(role)}>
                        配置权限
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
            <CardTitle>新建角色</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={createRole}>
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
                <Label>描述</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
              <Button type="submit" className="w-full">
                创建
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {selected && (
        <Card>
          <CardHeader>
            <CardTitle>为「{selected.name}」勾选功能点</CardTitle>
            <CardDescription>{selected.code}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(grouped).map(([module, items]) => (
              <div key={module}>
                <div className="mb-2 text-sm font-medium">{module}</div>
                <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                  {items.map((p) => (
                    <label key={p.id} className="flex items-center gap-2 rounded border p-2 text-sm">
                      <input
                        type="checkbox"
                        checked={permIds.includes(p.id)}
                        onChange={(e) => {
                          setPermIds((prev) =>
                            e.target.checked
                              ? [...prev, p.id]
                              : prev.filter((id) => id !== p.id),
                          );
                        }}
                      />
                      <span>
                        {p.name}
                        <span className="ml-1 font-mono text-xs text-muted-foreground">
                          {p.code}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
            <Button onClick={savePermissions}>保存权限</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
