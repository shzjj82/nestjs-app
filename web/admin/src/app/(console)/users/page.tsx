import { getRoleOptions, getUsersPage } from '@/lib/server-data';

import { UsersPageClient } from './users-client';

export default async function UsersPage() {
  const [initialData, initialRoles] = await Promise.all([getUsersPage(1, 20), getRoleOptions()]);
  return <UsersPageClient initialData={initialData} initialRoles={initialRoles} />;
}
