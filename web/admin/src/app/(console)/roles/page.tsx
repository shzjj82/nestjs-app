import { getBusinesses, getPermissions, getRoles } from '@/lib/server-data';

import { RolesPageClient } from './roles-client';

export default async function RolesPage() {
  const [businesses, permissions] = await Promise.all([
    getBusinesses(),
    getPermissions('platform'),
  ]);
  const businessId = businesses[0]?.id ?? '';
  const roles = businessId ? await getRoles(businessId) : [];
  return (
    <RolesPageClient
      initialBusinesses={businesses}
      initialPermissions={permissions}
      initialBusinessId={businessId}
      initialRoles={roles}
    />
  );
}
