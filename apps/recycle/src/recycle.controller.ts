import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import {
  ApiDoc,
  MQTT_GROUPS,
  MQTT_PATTERNS,
  serviceHealth,
  sharePattern,
} from '@app/common';

@Controller()
export class RecycleController {
  @MessagePattern(
    sharePattern(MQTT_GROUPS.RECYCLE, MQTT_PATTERNS.RECYCLE_HEALTH),
  )
  @ApiDoc({ name: '回收服务健康检查' })
  health() {
    return serviceHealth('recycle');
  }
}
