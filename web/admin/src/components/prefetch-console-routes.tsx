'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { CONSOLE_NAV_GROUPS } from '@/lib/console-nav';

/** 进入控制台后预取侧栏路由，减轻首次点击等待 */
export function PrefetchConsoleRoutes() {
  const router = useRouter();

  useEffect(() => {
    for (const group of CONSOLE_NAV_GROUPS) {
      for (const item of group.items) {
        router.prefetch(item.href);
      }
    }
  }, [router]);

  return null;
}
