'use client';

import { useCallback, useEffect, useState } from 'react';
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

interface UserIdentity {
  provider: string;
  identifier: string;
  unionid: string | null;
  appCode: string | null;
}

interface User {
  id: string;
  username: string | null;
  nickname: string;
  phone: string | null;
  email: string | null;
  status: number;
  appCodes?: string[];
  providers?: string[];
  identities?: UserIdentity[];
  roles?: string[];
}

interface PageResult {
  items: User[];
  total: number;
  page: number;
  pageSize: number;
}

interface Role {
  id: string;
  code: string;
  name: string;
}

export default function UsersPage() {
  const [keyword, setKeyword] = useState('');
  const [appCode, setAppCode] = useState('');
  const [data, setData] = useState<PageResult | null>(null);
  const [selected, setSelected] = useState<User | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [roleIds, setRoleIds] = useState<string[]>([]);
  const [form, setForm] = useState({
    username: '',
    password: '',
    nickname: '',
    phone: '',
  });

  const load = useCallback(async () => {
    const qs = new URLSearchParams();
    if (keyword) qs.set('keyword', keyword);
    if (appCode) qs.set('appCode', appCode);
    qs.set('page', '1');
    qs.set('pageSize', '50');
    const result = await adminFetch<PageResult>(`/users?${qs}`);
    setData(result);
  }, [keyword, appCode]);

  useEffect(() => {
    load().catch((err) => toast.error(err.message));
    adminFetch<Role[]>('/roles')
      .then(setRoles)
      .catch(() => undefined);
  }, [load]);

  async function openDetail(id: string) {
    try {
      const [user, allRoles] = await Promise.all([
        adminFetch<User>(`/users/${id}`),
        adminFetch<Role[]>('/roles'),
      ]);
      setRoles(allRoles);
      setSelected(user);
      const matched = allRoles
        .filter((r) => user.roles?.includes(r.code))
        .map((r) => r.id);
      setRoleIds(matched);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '加载失败');
    }
  }

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    try {
      await adminFetch('/users', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      toast.success('已创建用户');
      setForm({ username: '', password: '', nickname: '', phone: '' });
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '创建失败');
    }
  }

  async function saveRoles() {
    if (!selected) return;
    try {
      await adminFetch(`/users/${selected.id}/roles`, {
        method: 'PUT',
        body: JSON.stringify({ roleIds }),
      });
      toast.success('角色已更新');
      await openDetail(selected.id);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '更新失败');
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">用户账号</h1>
        <p className="text-sm text-muted-foreground">用户列表、详情与关联身份</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>筛选</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Input
            placeholder="关键词（用户名/昵称/手机）"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className="max-w-xs"
          />
          <Input
            placeholder="租户 appCode"
            value={appCode}
            onChange={(e) => setAppCode(e.target.value)}
            className="max-w-xs"
          />
          <Button onClick={() => load().catch((e) => toast.error(e.message))}>查询</Button>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>用户列表</CardTitle>
            <CardDescription>共 {data?.total ?? 0} 人</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>用户名</TableHead>
                  <TableHead>昵称</TableHead>
                  <TableHead>手机</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>租户</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.items ?? []).map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>{u.username || '—'}</TableCell>
                    <TableCell>{u.nickname}</TableCell>
                    <TableCell>{u.phone || '—'}</TableCell>
                    <TableCell>
                      <Badge variant={u.status === 1 ? 'success' : 'danger'}>
                        {u.status === 1 ? '正常' : '停用'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{(u.appCodes ?? []).join(', ') || '—'}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={() => openDetail(u.id)}>
                        详情
                      </Button>
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
              <CardTitle>创建账号</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-3" onSubmit={createUser}>
                <div className="space-y-1">
                  <Label>用户名</Label>
                  <Input
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label>密码</Label>
                  <Input
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label>昵称</Label>
                  <Input
                    value={form.nickname}
                    onChange={(e) => setForm({ ...form, nickname: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label>手机</Label>
                  <Input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </div>
                <Button type="submit" className="w-full">
                  创建
                </Button>
              </form>
            </CardContent>
          </Card>

          {selected && (
            <Card>
              <CardHeader>
                <CardTitle>{selected.nickname}</CardTitle>
                <CardDescription>{selected.username || selected.id}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="mb-2 text-sm font-medium">关联身份</div>
                  {(selected.identities ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">无第三方身份</p>
                  ) : (
                    <ul className="space-y-2 text-sm">
                      {selected.identities!.map((id, idx) => (
                        <li key={idx} className="rounded border p-2">
                          <div>{id.provider}</div>
                          <div className="font-mono text-xs">{id.identifier}</div>
                          <div className="text-xs text-muted-foreground">
                            appCode: {id.appCode || '—'}
                            {id.unionid ? ` · unionid: ${id.unionid}` : ''}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <div className="mb-2 text-sm font-medium">分配角色</div>
                  <div className="space-y-2">
                    {roles.map((role) => (
                      <label key={role.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={roleIds.includes(role.id)}
                          onChange={(e) => {
                            setRoleIds((prev) =>
                              e.target.checked
                                ? [...prev, role.id]
                                : prev.filter((id) => id !== role.id),
                            );
                          }}
                        />
                        {role.name} ({role.code})
                      </label>
                    ))}
                  </div>
                  <Button className="mt-3 w-full" onClick={saveRoles}>
                    保存角色
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
