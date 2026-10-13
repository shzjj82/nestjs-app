'use client';

import { X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useEffect, useState, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

export function DataTableBulkBar({
  count,
  onClear,
  children,
}: {
  count: number;
  onClear: () => void;
  children: ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || count <= 0) return null;

  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
      <div className="pointer-events-auto flex max-w-[min(100%,42rem)] items-center gap-3 rounded-full border bg-background/95 px-3 py-2 shadow-lg backdrop-blur supports-backdrop-filter:bg-background/80">
        <div className="flex items-center gap-2 pl-1 text-sm">
          <span className="inline-flex size-6 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground tabular-nums">
            {count}
          </span>
          <span className="whitespace-nowrap text-muted-foreground">已选</span>
        </div>
        <Separator orientation="vertical" className="data-vertical:h-5" />
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">{children}</div>
        <Separator orientation="vertical" className="data-vertical:h-5" />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="取消选择"
          onClick={onClear}
        >
          <X />
        </Button>
      </div>
    </div>,
    document.body,
  );
}
