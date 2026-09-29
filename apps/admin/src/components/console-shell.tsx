'use client';

import { ConsoleTopbar } from '@/components/console-topbar';
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
    <SidebarProvider defaultOpen={defaultSidebarOpen}>
      <AppSidebar />
      <SidebarInset>
        <ConsoleTopbar user={user} />
        <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-4 md:p-6">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
