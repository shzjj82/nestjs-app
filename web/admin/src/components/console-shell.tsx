'use client';

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
  return (
    <SidebarProvider defaultOpen={defaultSidebarOpen} className="h-svh overflow-hidden">
      <PrefetchConsoleRoutes />
      <AppSidebar />
      <SidebarInset className="min-h-0 overflow-hidden">
        <ConsoleTopbar user={user} />
        <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col gap-6 overflow-hidden p-4 md:p-6">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
