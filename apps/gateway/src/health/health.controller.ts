import { Controller, Get } from '@nestjs/common';
import {
  AGENTS_CLIENT,
  DOCS_CLIENT,
  MQTT_PATTERNS,
  ORDER_CLIENT,
  UPLOAD_CLIENT,
  USER_CLIENT,
  WECHAT_CLIENT,
  appVersion,
  instanceId,
  unwrapData,
} from '@app/common';
import type { ServiceHealth } from '@app/common';
import { ClientHub } from '../mqtt/client.hub';

@Controller()
export class HealthController {
  constructor(private readonly clients: ClientHub) {}

  @Get()
  info() {
    return {
      service: 'gateway',
      entry: 'http',
      message: '所有外部请求只走网关，再经 MQTT 路由到后端服务',
    };
  }

  @Get('health')
  async health() {
    const gateway: ServiceHealth = {
      status: 'up',
      service: 'gateway',
      instance: instanceId('gateway'),
      version: appVersion(),
    };

    const [usercenter, order, docs, upload, wechat, agents] = await Promise.all([
      this.probe(USER_CLIENT, MQTT_PATTERNS.USER_HEALTH, 'usercenter'),
      this.probe(ORDER_CLIENT, MQTT_PATTERNS.ORDER_HEALTH, 'order'),
      this.probe(DOCS_CLIENT, MQTT_PATTERNS.DOC_HEALTH, 'docs'),
      this.probe(UPLOAD_CLIENT, MQTT_PATTERNS.UPLOAD_HEALTH, 'upload'),
      this.probe(WECHAT_CLIENT, MQTT_PATTERNS.WECHAT_HEALTH, 'wechat'),
      this.probe(AGENTS_CLIENT, MQTT_PATTERNS.AGENTS_HEALTH, 'agents'),
    ]);

    const services = { gateway, usercenter, order, docs, upload, wechat, agents };
    const allUp = Object.values(services).every(
      (item) => item.status === 'up' || item.status === 'ok',
    );

    return {
      status: allUp ? 'up' : 'degraded',
      expectedVersion: process.env.EXPECTED_APP_VERSION ?? appVersion(),
      services,
    };
  }

  private async probe(
    client: string,
    pattern: string,
    service: string,
  ): Promise<ServiceHealth & Record<string, unknown>> {
    try {
      const raw = await this.clients.send(client, pattern, {});
      const data = unwrapData<ServiceHealth & Record<string, unknown>>(raw);
      if (!data || typeof data !== 'object') {
        return {
          status: 'down',
          service,
          instance: 'unknown',
          version: 'unknown',
        };
      }
      return {
        ...data,
        status: data.status === 'ok' || data.status === 'up' ? 'up' : 'down',
        service: data.service ?? service,
        instance: data.instance ?? 'unknown',
        version: data.version ?? 'unknown',
      };
    } catch {
      return {
        status: 'down',
        service,
        instance: 'unknown',
        version: 'unknown',
      };
    }
  }
}
