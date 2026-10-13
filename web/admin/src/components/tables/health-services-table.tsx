'use client';

import { useMemo } from 'react';
import { DataTable } from '@/components/data-table';
import type { FilterField } from '@/components/filter-bar';
import type { AdminColumnDef } from '@/lib/admin-table-types';
import { CircleAlert } from 'lucide-react';
import { StatusBadge } from '@/components/status-badge';
import { Badge } from '@/components/ui/badge';

export type HealthServiceRow = {
  key: string;
  service: string;
  status: string;
  instance: string;
  version: string;
  expected: string;
};

const HEALTH_FILTERS: FilterField<HealthServiceRow>[] = [
  {
    id: 'service',
    type: 'text',
    label: '服务',
    placeholder: '搜索服务...',
    accessor: (row) => `${row.service} ${row.key}`,
  },
  {
    id: 'status',
    type: 'select',
    label: '状态',
    accessor: (row) => (row.status === 'up' || row.status === 'ok' ? 'up' : 'down'),
    options: [
      { label: '在线', value: 'up' },
      { label: '离线', value: 'down' },
    ],
  },
];

export function HealthServicesDataTable({
  rows,
}: {
  rows: HealthServiceRow[];
}) {
  const columns = useMemo<AdminColumnDef<HealthServiceRow>[]>(
    () => [
      {
        accessorKey: 'service',
        header: '服务',
        meta: { label: '服务' },
        cell: ({ row }) => (
          <span className="font-medium">{row.original.service || row.original.key}</span>
        ),
      },
      {
        accessorKey: 'status',
        header: '状态',
        meta: { label: '状态' },
        cell: ({ row }) => {
          const up = row.original.status === 'up' || row.original.status === 'ok';
          return <StatusBadge active={up} activeLabel={row.original.status} inactiveLabel={row.original.status} />;
        },
      },
      {
        accessorKey: 'instance',
        header: '实例',
        meta: { label: '实例' },
        cell: ({ row }) => (
          <span className="font-mono text-xs">{row.original.instance}</span>
        ),
      },
      {
        accessorKey: 'version',
        header: '版本',
        meta: { label: '版本' },
        cell: ({ row }) => (
          <span className="font-mono text-xs">{row.original.version}</span>
        ),
      },
      {
        id: 'latest',
        accessorFn: (row) => {
          const up = row.status === 'up' || row.status === 'ok';
          if (!up) return '离线';
          return row.version === row.expected ? '当前版本' : '版本不一致';
        },
        header: '是否最新',
        meta: { label: '是否最新' },
        cell: ({ row }) => {
          const up = row.original.status === 'up' || row.original.status === 'ok';
          const latest = up && row.original.version === row.original.expected;
          if (!up) return <StatusBadge active={false} inactiveLabel="离线" />;
          return latest ? (
            <StatusBadge active activeLabel="当前版本" />
          ) : (
            <Badge variant="outline" className="py-1 [&>svg]:size-3.5">
              <CircleAlert />
              版本不一致
            </Badge>
          );
        },
      },
    ],
    [],
  );

  return (
    <DataTable
      columns={columns}
      data={rows}
      filters={HEALTH_FILTERS}
      enableRowSelection={false}
      emptyMessage="暂无服务数据"
    />
  );
}
