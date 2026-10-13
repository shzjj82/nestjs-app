import { DataTableSkeleton } from '@/components/data-table/data-table-skeleton';
import { Skeleton } from '@/components/ui/skeleton';

export default function ConsoleLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <DataTableSkeleton columnCount={5} rowCount={8} filterCount={2} />
    </div>
  );
}
