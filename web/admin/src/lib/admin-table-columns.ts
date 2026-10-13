import type { RowData } from '@tanstack/react-table';

import type { AdminColumnDef } from '@/lib/admin-table-types';

/** 操作列：不参与筛选、不可隐藏 */
export function actionsColumn<TData extends RowData>(
  def: AdminColumnDef<TData>,
): AdminColumnDef<TData> {
  return {
    enableSorting: false,
    enableColumnFilter: false,
    enableHiding: false,
    ...def,
  };
}
