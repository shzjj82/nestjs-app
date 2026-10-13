import {
  getDocsCategories,
  getDocsDocuments,
  getDocsSpaceBusinesses,
} from '@/lib/server-data';

import { DocsPageClient } from './docs-client';

export default async function DocsPage() {
  const businesses = await getDocsSpaceBusinesses();
  const bizCode = businesses[0]?.code ?? '';
  const [docs, categories] = bizCode
    ? await Promise.all([getDocsDocuments(bizCode, 1, 20), getDocsCategories(bizCode)])
    : [{ items: [], total: 0, page: 1, pageSize: 20 }, []];

  return (
    <DocsPageClient
      initialBusinesses={businesses}
      initialBizCode={bizCode}
      initialDocs={docs.items}
      initialCategories={categories}
      initialPage={docs.page}
      initialPageSize={docs.pageSize}
      initialTotal={docs.total}
    />
  );
}
