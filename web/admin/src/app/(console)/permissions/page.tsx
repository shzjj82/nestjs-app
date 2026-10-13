import { getPermissions } from '@/lib/server-data';

import { PermissionsPageClient } from './permissions-client';

export default async function PermissionsPage() {
  const initialItems = await getPermissions();
  return <PermissionsPageClient initialItems={initialItems} />;
}
