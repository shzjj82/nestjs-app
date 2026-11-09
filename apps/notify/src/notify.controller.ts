import { Controller, UseInterceptors } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { MQTT_PATTERNS, NotifyHandleLogInterceptor, serviceHealth, sharePattern, MQTT_GROUPS } from '@app/common';

@Controller()
@UseInterceptors(NotifyHandleLogInterceptor)
export class NotifyController {
  @MessagePattern(sharePattern(MQTT_GROUPS.NOTIFY, MQTT_PATTERNS.NOTIFY_HEALTH))
  health() {
    return serviceHealth('notify');
  }
}
