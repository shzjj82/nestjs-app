import { expectedAppVersion } from '@/lib/api';
import { gatewayFetch } from '@/lib/auth';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">运维总览</h1>
        <p className="text-sm text-muted-foreground">
          各微服务状态与版本；期望版本 {expected}
        </p>
      </div>

      {error ? (
        <Card>
          <CardHeader>
            <CardTitle>网关不可用</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>整体状态</CardDescription>
                <CardTitle className="text-xl">
                  <Badge variant={health?.status === 'up' ? 'success' : 'danger'}>
                    {health?.status ?? 'unknown'}
                  </Badge>
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>服务数量</CardDescription>
                <CardTitle className="text-xl">{entries.length}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>在线</CardDescription>
                <CardTitle className="text-xl">
                  {entries.filter(([, s]) => s.status === 'up' || s.status === 'ok').length}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>服务列表</CardTitle>
              <CardDescription>
                version 与期望版本一致时视为当前发布版本
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>服务</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>实例</TableHead>
                    <TableHead>版本</TableHead>
                    <TableHead>是否最新</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map(([name, svc]) => {
                    const up = svc.status === 'up' || svc.status === 'ok';
                    const latest = up && svc.version === expected;
                    return (
                      <TableRow key={name}>
                        <TableCell className="font-medium">{svc.service || name}</TableCell>
                        <TableCell>
                          <Badge variant={up ? 'success' : 'danger'}>{svc.status}</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{svc.instance}</TableCell>
                        <TableCell className="font-mono text-xs">{svc.version}</TableCell>
                        <TableCell>
                          {up ? (
                            <Badge variant={latest ? 'success' : 'secondary'}>
                              {latest ? '当前版本' : '版本不一致'}
                            </Badge>
                          ) : (
                            <Badge variant="danger">离线</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
