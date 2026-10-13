import type { DataTableColumnMeta } from '@/lib/data-table-types';

declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-object-type
  interface ColumnMeta<TData, TValue> extends DataTableColumnMeta {}
}
