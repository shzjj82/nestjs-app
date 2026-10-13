import { expectedAppVersion } from '@/lib/api';
import { gatewayFetch } from '@/lib/auth';
import { PageHeader } from '@/components/page-header';
import { HealthServicesDataTable } from '@/components/tables/health-services-table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface ServiceHealth {
  status: string;
  service: string;
  instance: string;
  version: string;
  storage?: unknown;
}

interface HealthPayload {
  status: string;
  expectedVersion?: string;
  services: Record<string, ServiceHealth>;
}

export default async function OverviewPage() {
  let health: HealthPayload | null = null;
  let error: string | null = null;
  try {
    health = await gatewayFetch<HealthPayload>('/health');
  } catch (err) {
    error = err instanceof Error ? err.message : '无法获取健康状态';
  }

  const expected =
    health?.expectedVersion || expectedAppVersion() || '0.0.1';
  const entries = health ? Object.entries(health.services) : [];
  const serviceRows = entries.map(([name, svc]) => ({
    key: name,
    service: svc.service || name,
    status: svc.status,
    instance: svc.instance,
    version: svc.version,
    expected,
  }));
  const onlineCount = entries.filter(([, s]) => s.status === 'up' || s.status === 'ok').length;

  return (
    <>
      <PageHeader
        title="运维总览"
        description={`各微服务状态与版本；期望版本 ${expected}`}
      />

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>网关不可用</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardDescription>整体状态</CardDescription>
                <CardTitle>
                  <Badge variant={health?.status === 'up' ? 'success' : 'danger'}>
                    {health?.status ?? 'unknown'}
                  </Badge>
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardDescription>服务数量</CardDescription>
                <CardTitle className="text-2xl tabular-nums">{entries.length}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardDescription>在线</CardDescription>
                <CardTitle className="text-2xl tabular-nums">{onlineCount}</CardTitle>
              </CardHeader>
            </Card>
          </div>

          <HealthServicesDataTable rows={serviceRows} />
        </>
      )}
    </>
  );
}
