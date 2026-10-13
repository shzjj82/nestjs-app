import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/** 控制台页根容器：占满侧栏内容区，让表格可在剩余高度内滚动 */
export function ConsolePage({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex min-h-0 flex-1 flex-col gap-6 overflow-hidden', className)}>
      {children}
    </div>
  );
}
