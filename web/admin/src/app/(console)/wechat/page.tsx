import { getBusinesses, getWechatMiniprograms } from '@/lib/server-data';

import { WechatPageClient } from './wechat-client';

export default async function WechatPage() {
  const [initialApps, initialBusinesses] = await Promise.all([
    getWechatMiniprograms(),
    getBusinesses(),
  ]);
  return <WechatPageClient initialApps={initialApps} initialBusinesses={initialBusinesses} />;
}
