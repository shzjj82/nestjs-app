import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ConsoleShell } from '@/components/console-shell';
import { fetchMe, isAdmin } from '@/lib/auth';

export default async function ConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await fetchMe();
  if (!user || !isAdmin(user)) {
    redirect('/login');
  }

  const cookieStore = await cookies();
  const sidebarOpen = cookieStore.get('sidebar_state')?.value !== 'false';

  return (
    <ConsoleShell user={user} defaultSidebarOpen={sidebarOpen}>
      {children}
    </ConsoleShell>
  );
}
