import { getBusinesses } from '@/lib/server-data';

import { BusinessesPageClient } from './businesses-client';

export default async function BusinessesPage() {
  const initialItems = await getBusinesses();
  return <BusinessesPageClient initialItems={initialItems} />;
}
