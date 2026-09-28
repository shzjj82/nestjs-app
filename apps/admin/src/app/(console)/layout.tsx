import { redirect } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
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

  return (
    <div className="flex min-h-screen bg-muted/20">
      <Sidebar user={user} />
      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-7xl p-6 md:p-8">{children}</div>
      </main>
    </div>
  );
}
