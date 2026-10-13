import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/** 控制台页根容器。纵向滚动在壳层主区域，滚动条贴屏幕右缘。 */
export function ConsolePage({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn('flex flex-col gap-6', className)}>{children}</div>;
}
