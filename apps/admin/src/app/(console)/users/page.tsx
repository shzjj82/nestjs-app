'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Ban, CircleCheck, Eye } from 'lucide-react';
import { toast } from 'sonner';

import { DataTable } from '@/components/data-table';
import { DataTableRowActions } from '@/components/data-table-row-actions';
import { type FilterField, type FilterValues, filtersToSearchParams } from '@/components/filter-bar';
import { PageHeader } from '@/components/page-header';
import { StatusBadge } from '@/components/status-badge';
import { type RoleOption, UserAccountCard } from '@/components/user-account-card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { actionsColumn } from '@/lib/admin-table-columns';
import type { AdminColumnDef } from '@/lib/admin-table-types';
import { ACCOUNT_TYPE_META, type CenterUser, formatDateTime } from '@/lib/accounts';
import { adminFetch } from '@/lib/api';
import { type Business, type BusinessRole, PLATFORM_ROLE_SCOPE } from '@/lib/businesses';

interface PageResult {
  items: CenterUser[];
  total: number;
  page: number;
  pageSize: number;
}

const STATUS_OPTIONS = [
  { label: '正常', value: '1' },
  { label: '停用', value: '0' },
];

function errorMessage(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

export default function UsersPage() {
  const [filters, setFilters] = useState<FilterValues>({});
  const [data, setData] = useState<PageResult | null>(null);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selected, setSelected] = useState<CenterUser | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const qs = filtersToSearchParams(filters);
      qs.set('page', String(page));
      qs.set('pageSize', String(pageSize));
      setData(await adminFetch<PageResult>(`/users?${qs}`));
    } catch (err) {
      toast.error(errorMessage(err, '加载失败'));
    }
  }, [filters, page, pageSize]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    Promise.all([adminFetch<BusinessRole[]>('/roles'), adminFetch<Business[]>('/businesses')])
      .then(([roleList, businesses]) => {
        const names = new Map(businesses.map((b) => [b.id, b.name]));
        setRoles(
          roleList.map((role) => ({
            id: role.id,
            code: role.code,
            name: role.name,
            businessLabel: role.businessId
              ? (names.get(role.businessId) ?? role.businessId)
              : PLATFORM_ROLE_SCOPE,
          })),
        );
      })
      .catch(() => undefined);
  }, []);

  const handleFiltersChange = useCallback((next: FilterValues) => {
    setFilters(next);
    setPage(1);
  }, []);

  const filterFields = useMemo<FilterField<CenterUser>[]>(
    () => [
      { id: 'keyword', type: 'text', label: '关键词', placeholder: '搜索昵称 / 手机 / 邮箱 / 登录名...' },
      {
        id: 'role',
        type: 'multiSelect',
        label: '角色',
        options: roles.map((r) => ({ label: r.name, value: r.code })),
      },
      { id: 'status', type: 'multiSelect', label: '状态', options: STATUS_OPTIONS },
    ],
    [roles],
  );

  const openDetail = useCallback(async (id: string) => {
    try {
      setSelected(await adminFetch<CenterUser>(`/users/${id}`));
      setDetailOpen(true);
    } catch (err) {
      toast.error(errorMessage(err, '加载失败'));
    }
  }, []);

  const toggleUserStatus = useCallback(
    async (user: CenterUser) => {
      try {
        await adminFetch(`/users/${user.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ status: user.status === 1 ? 0 : 1 }),
        });
        toast.success(user.status === 1 ? '用户已停用' : '用户已启用');
        await load();
      } catch (err) {
        toast.error(errorMessage(err, '操作失败'));
      }
    },
    [load],
  );

  async function updateAccount(path: string, init: RequestInit, message: string) {
    try {
      setSelected(await adminFetch<CenterUser>(path, init));
      toast.success(message);
      await load();
    } catch (err) {
      toast.error(errorMessage(err, '操作失败'));
    }
  }

  const columns = useMemo<AdminColumnDef<CenterUser>[]>(
    () => [
      {
        accessorKey: 'nickname',
        header: '用户',
        meta: { label: '用户' },
        cell: ({ row }) => (
          <div className="min-w-0">
            <div className="truncate font-medium">{row.original.nickname || '—'}</div>
            <div className="truncate text-xs text-muted-foreground">
              {row.original.email || row.original.id.slice(0, 8)}
            </div>
          </div>
        ),
      },
      {
        accessorKey: 'phone',
        header: '手机',
        meta: { label: '手机' },
        cell: ({ row }) => row.original.phone || '—',
      },
      {
        id: 'accounts',
        header: '关联账户',
        accessorFn: (row) => row.accounts?.length ?? 0,
        meta: { label: '关联账户' },
        cell: ({ row }) => {
          const accounts = row.original.accounts ?? [];
          if (!accounts.length) return <span className="text-muted-foreground">—</span>;
          return (
            <div className="flex flex-wrap gap-1">
              {accounts.map((account) => {
                const meta = ACCOUNT_TYPE_META[account.type];
                const Icon = meta?.icon;
                return (
                  <Badge
                    key={account.id}
                    variant="outline"
                    className={account.status === 1 ? undefined : 'opacity-50'}
                    title={`${meta?.label ?? account.type}：${account.identifier}`}
                  >
                    {Icon ? <Icon /> : null}
                    <span className="max-w-28 truncate">
                      {account.type === 'password' ? account.identifier : meta?.label}
                    </span>
                  </Badge>
                );
              })}
            </div>
          );
        },
      },
      {
        id: 'roles',
        header: '角色',
        enableSorting: false,
        accessorFn: (row) =>
          [...new Set((row.accounts ?? []).flatMap((a) => a.roleNames))].join(', '),
        meta: { label: '角色' },
        cell: ({ row }) => {
          const names = [...new Set((row.original.accounts ?? []).flatMap((a) => a.roleNames))];
          if (!names.length) return <span className="text-muted-foreground">—</span>;
          return (
            <div className="flex flex-wrap gap-1">
              {names.map((name) => (
                <Badge key={name} variant="secondary">
                  {name}
                </Badge>
              ))}
            </div>
          );
        },
      },
      {
        id: 'status',
        accessorFn: (row) => String(row.status),
        header: '状态',
        meta: { label: '状态' },
        cell: ({ row }) => <StatusBadge active={row.original.status === 1} />,
      },
      {
        accessorKey: 'createdAt',
        header: '注册时间',
        meta: { label: '注册时间' },
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {formatDateTime(row.original.createdAt)}
          </span>
        ),
      },
      actionsColumn({
        id: 'actions',
        header: () => <span className="sr-only">操作</span>,
        meta: { label: '操作' },
        cell: ({ row }) => (
          <DataTableRowActions
            actions={[
              { label: '账户与角色', icon: Eye, onSelect: () => openDetail(row.original.id) },
              {
                label: row.original.status === 1 ? '停用用户' : '启用用户',
                icon: row.original.status === 1 ? Ban : CircleCheck,
                variant: row.original.status === 1 ? 'destructive' : 'default',
                separatorBefore: true,
                onSelect: () => toggleUserStatus(row.original),
              },
            ]}
          />
        ),
      }),
    ],
    [openDetail, toggleUserStatus],
  );

  const accounts = selected?.accounts ?? [];

  return (
    <>
      <PageHeader
        title="用户"
        description="一个用户可关联多个登录账户，角色按账户分配"
      />

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        filters={filterFields}
        onFiltersChange={handleFiltersChange}
        emptyMessage="暂无用户"
        pagination={{
          mode: 'server',
          page: data?.page ?? page,
          pageSize: data?.pageSize ?? pageSize,
          total: data?.total ?? 0,
          onChange: ({ page: nextPage, pageSize: nextSize }) => {
            setPage(nextPage);
            setPageSize(nextSize);
          },
        }}
      />

      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent className="w-full gap-0 data-[side=right]:sm:max-w-lg">
          <SheetHeader className="border-b">
            <SheetTitle className="flex items-center gap-2">
              {selected?.nickname || '用户详情'}
              {selected ? <StatusBadge active={selected.status === 1} /> : null}
            </SheetTitle>
            <SheetDescription className="font-mono text-xs">{selected?.id}</SheetDescription>
          </SheetHeader>
          {selected ? (
            <div className="flex-1 space-y-5 overflow-y-auto p-4">
              <dl className="grid grid-cols-[5rem_1fr] gap-y-2 text-sm">
                <dt className="text-muted-foreground">手机</dt>
                <dd>{selected.phone || '—'}</dd>
                <dt className="text-muted-foreground">邮箱</dt>
                <dd>{selected.email || '—'}</dd>
                <dt className="text-muted-foreground">注册时间</dt>
                <dd>{formatDateTime(selected.createdAt)}</dd>
              </dl>
              <Separator />
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">关联账户</div>
                  <span className="text-xs text-muted-foreground">共 {accounts.length} 个</span>
                </div>
                {accounts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">该用户暂无账户</p>
                ) : (
                  accounts.map((account) => (
                    <UserAccountCard
                      key={`${account.id}:${account.roleIds.join(',')}`}
                      account={account}
                      roles={roles}
                      onSaveRoles={(roleIds) =>
                        updateAccount(
                          `/accounts/${account.id}/roles`,
                          { method: 'PUT', body: JSON.stringify({ roleIds }) },
                          '账户角色已更新',
                        )
                      }
                      onToggleStatus={() =>
                        updateAccount(
                          `/accounts/${account.id}`,
                          {
                            method: 'PATCH',
                            body: JSON.stringify({ status: account.status === 1 ? 0 : 1 }),
                          },
                          account.status === 1 ? '账户已停用' : '账户已启用',
                        )
                      }
                    />
                  ))
                )}
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}
