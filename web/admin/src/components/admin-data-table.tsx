'use client';

import {
  type PaginationState,
  type RowData,
  type Updater,
  useTable,
} from '@tanstack/react-table';
import * as React from 'react';

import { DataTable as TablecnDataTable } from '@/components/data-table/data-table';
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header';
import { DataTableSortList } from '@/components/data-table/data-table-sort-list';
import { DataTableViewOptions } from '@/components/data-table/data-table-view-options';
import { FilterBar, type FilterField, type FilterValues, filterRows } from '@/components/filter-bar';
import { Checkbox } from '@/components/ui/checkbox';
import { useDebouncedCallback } from '@/hooks/use-debounced-callback';
import { dataTableFeatures } from '@/lib/data-table-features';
import type { AdminColumnDef } from '@/lib/admin-table-types';

function selectColumn<TData extends RowData>(): AdminColumnDef<TData> {
  return {
    id: 'select',
    header: ({ table }) => (
      <Checkbox
        aria-label="全选"
        checked={table.getIsAllPageRowsSelected()}
        indeterminate={!table.getIsAllPageRowsSelected() && table.getIsSomePageRowsSelected()}
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(value)}
        className="translate-y-0.5"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        aria-label="选择行"
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(value)}
        className="translate-y-0.5"
      />
    ),
    enableSorting: false,
    enableHiding: false,
    size: 40,
  };
}

function withColumnHeader<TData extends RowData>(
  column: AdminColumnDef<TData>,
): AdminColumnDef<TData> {
  if (typeof column.header !== 'string') return column;
  const label = column.meta?.label ?? column.header;
  const next = { ...column };
  next.meta = { ...next.meta, label };
  next.header = ({ column: col }) => (
    <DataTableColumnHeader column={col} label={label} />
  );
  return next;
}

export type AdminDataTablePagination =
  | {
      mode: 'client';
      pageSize?: number;
    }
  | {
      mode: 'server';
      page: number;
      pageSize: number;
      total: number;
      onChange: (next: { page: number; pageSize: number }) => void;
    };

export type AdminDataTableProps<TData extends RowData> = {
  columns: AdminColumnDef<TData>[];
  data: TData[];
  className?: string;
  /** 保留兼容；空状态文案由 tablecn DataTable 默认展示 */
  emptyMessage?: string;
  pagination?: AdminDataTablePagination | false;
  /** 顶部筛选条件；客户端分页时在前端过滤，服务端分页时只通过 onFiltersChange 抛出 */
  filters?: FilterField<TData>[];
  /** 筛选值变化（服务端模式下已防抖） */
  onFiltersChange?: (values: FilterValues) => void;
  filterDebounceMs?: number;
  /** 工具栏右侧追加的操作 */
  toolbarActions?: React.ReactNode;
  initialColumnVisibility?: Record<string, boolean>;
  /** 首列勾选框（tablecn 默认样式），默认开启 */
  enableRowSelection?: boolean;
};

export function AdminDataTable<TData extends RowData>({
  columns,
  data,
  className,
  pagination = { mode: 'client', pageSize: 20 },
  filters = [],
  onFiltersChange,
  filterDebounceMs = 300,
  toolbarActions,
  initialColumnVisibility,
  enableRowSelection = true,
}: AdminDataTableProps<TData>) {
  const tableColumns = React.useMemo(
    () => [
      ...(enableRowSelection ? [selectColumn<TData>()] : []),
      ...columns.map(withColumnHeader),
    ],
    [columns, enableRowSelection],
  );

  const paginateEnabled = pagination !== false;
  const serverMode = paginateEnabled && pagination.mode === 'server';
  const clientPageSize =
    paginateEnabled && pagination.mode === 'client'
      ? (pagination.pageSize ?? 20)
      : 20;

  const serverPageIndex = serverMode ? Math.max(0, pagination.page - 1) : 0;
  const serverPageSize = serverMode ? pagination.pageSize : clientPageSize;
  const serverPageCount =
    serverMode && pagination.pageSize > 0
      ? Math.max(1, Math.ceil(pagination.total / pagination.pageSize))
      : 1;

  const [clientPagination, setClientPagination] = React.useState<PaginationState>(() => ({
    pageIndex: 0,
    pageSize: clientPageSize,
  }));
  const [filterValues, setFilterValues] = React.useState<FilterValues>({});

  const emitFiltersChange = useDebouncedCallback(
    (values: FilterValues) => onFiltersChange?.(values),
    serverMode ? filterDebounceMs : 0,
  );

  const handleFilterChange = React.useCallback(
    (values: FilterValues) => {
      setFilterValues(values);
      if (!serverMode) setClientPagination((prev) => ({ ...prev, pageIndex: 0 }));
      emitFiltersChange(values);
    },
    [emitFiltersChange, serverMode],
  );

  const rows = React.useMemo(
    () => (serverMode ? data : filterRows(data, filters, filterValues)),
    [data, filters, filterValues, serverMode],
  );

  const paginationState: PaginationState = serverMode
    ? { pageIndex: serverPageIndex, pageSize: serverPageSize }
    : clientPagination;

  const onPaginationChange = React.useCallback(
    (updater: Updater<PaginationState>) => {
      if (serverMode) {
        const next =
          typeof updater === 'function' ? updater(paginationState) : updater;
        pagination.onChange({
          page: next.pageIndex + 1,
          pageSize: next.pageSize,
        });
        return;
      }
      setClientPagination((prev) =>
        typeof updater === 'function' ? updater(prev) : updater,
      );
    },
    [paginationState, serverMode, pagination],
  );

  const table = useTable(
    {
      features: dataTableFeatures,
      data: rows,
      columns: tableColumns,
      enableRowSelection,
      getRowId: (row, index) => {
        const id = (row as { id?: unknown }).id;
        return typeof id === 'string' || typeof id === 'number' ? String(id) : String(index);
      },
      initialState: { columnVisibility: initialColumnVisibility ?? {} },
      ...(paginateEnabled
        ? {
            pageCount: serverMode ? serverPageCount : undefined,
            manualPagination: serverMode,
          }
        : {}),
      state: {
        pagination: paginateEnabled ? paginationState : undefined,
      },
      onPaginationChange: paginateEnabled ? onPaginationChange : undefined,
    },
    (state) => ({
      pagination: state.pagination,
    }),
  );

  return (
    <TablecnDataTable table={table} className={className}>
      <FilterBar
        fields={filters}
        value={filterValues}
        onChange={handleFilterChange}
        actions={
          <>
            {toolbarActions}
            <DataTableSortList table={table} />
            <DataTableViewOptions table={table} align="end" />
          </>
        }
      />
    </TablecnDataTable>
  );
}
