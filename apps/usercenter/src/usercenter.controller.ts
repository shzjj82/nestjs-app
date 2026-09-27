import { Controller, UseInterceptors } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { MQTT_PATTERNS, UsercenterHandleLogInterceptor } from '@app/common';
import { ucPattern } from './rpc';
import { UsercenterService } from './usercenter.service';

@Controller()
@UseInterceptors(UsercenterHandleLogInterceptor)
export class UsercenterController {
  constructor(private readonly usercenterService: UsercenterService) {}

  @MessagePattern(ucPattern(MQTT_PATTERNS.USER_HEALTH))
  health() {
    return this.usercenterService.health();
  }
}
