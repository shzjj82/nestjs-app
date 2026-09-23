import { Controller, Get } from '@nestjs/common';
import { MQTT_PATTERNS, ORDER_CLIENT, USER_CLIENT } from '@app/common';
import type { ServiceEnvelope } from '@app/common';
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
    const [usercenter, order] = await Promise.all([
      this.clients.send<ServiceEnvelope<null>>(
        USER_CLIENT,
        MQTT_PATTERNS.USER_HEALTH,
      ),
      this.clients.send<ServiceEnvelope<null>>(
        ORDER_CLIENT,
        MQTT_PATTERNS.ORDER_HEALTH,
      ),
    ]);

    return {
      gateway: 'ok',
      upstream: { usercenter, order },
    };
  }
}
