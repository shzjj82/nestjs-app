import type { ColumnDef, RowData } from '@tanstack/react-table';

import type { DataTableFeatures } from '@/lib/data-table-features';

/** 管理后台列定义（tablecn / TanStack Table v9） */
export type AdminColumnDef<TData extends RowData, TValue = unknown> = ColumnDef<
  DataTableFeatures,
  TData,
  TValue
>;
