import { Controller, UseInterceptors } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { MQTT_PATTERNS, UsercenterHandleLogInterceptor, sharePattern, MQTT_GROUPS } from '@app/common';
import { UsercenterService } from './usercenter.service';

@Controller()
@UseInterceptors(UsercenterHandleLogInterceptor)
export class UsercenterController {
  constructor(private readonly usercenterService: UsercenterService) {}

  @MessagePattern(sharePattern(MQTT_GROUPS.USERCENTER, MQTT_PATTERNS.USER_HEALTH))
  health() {
    return this.usercenterService.health();
  }
}
