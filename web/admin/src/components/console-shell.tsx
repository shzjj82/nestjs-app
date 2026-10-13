'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { ConsoleTopbar } from '@/components/console-topbar';
import { PrefetchConsoleRoutes } from '@/components/prefetch-console-routes';
import { AppSidebar } from '@/components/sidebar';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import type { AdminUser } from '@/lib/auth';

export function ConsoleShell({
  user,
  defaultSidebarOpen,
  children,
}: {
  user: AdminUser;
  defaultSidebarOpen: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: 0 });
  }, [pathname]);

  return (
    <SidebarProvider defaultOpen={defaultSidebarOpen} className="h-svh overflow-hidden">
      <PrefetchConsoleRoutes />
      <AppSidebar />
      <SidebarInset className="min-h-0 overflow-hidden">
        <ConsoleTopbar user={user} />
        <div ref={scrollerRef} className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 md:p-6">
            {children}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
