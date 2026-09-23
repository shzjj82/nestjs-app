import { Controller, UseInterceptors } from '@nestjs/common';
import { MessagePattern, RpcException } from '@nestjs/microservices';
import { MQTT_GROUPS, MQTT_PATTERNS, sharePattern } from '@app/common';
import type { CreateUserDto } from '@app/common';
import { HandleLogInterceptor } from './handle-log.interceptor';
import { UsercenterService } from './usercenter.service';

@Controller()
@UseInterceptors(HandleLogInterceptor)
export class UsercenterController {
  constructor(private readonly usercenterService: UsercenterService) {}

  @MessagePattern(sharePattern(MQTT_GROUPS.USERCENTER, MQTT_PATTERNS.USER_HEALTH))
  health() {
    return this.usercenterService.health();
  }

  @MessagePattern(sharePattern(MQTT_GROUPS.USERCENTER, MQTT_PATTERNS.USER_FIND_ALL))
  findAll() {
    return this.usercenterService.findAll();
  }

  @MessagePattern(sharePattern(MQTT_GROUPS.USERCENTER, MQTT_PATTERNS.USER_FIND_ONE))
  findOne(payload: { id: string }) {
    const user = this.usercenterService.findOne(payload.id);
    if (!user) {
      throw new RpcException({ status: 404, message: `用户 ${payload.id} 不存在` });
    }
    return user;
  }

  @MessagePattern(sharePattern(MQTT_GROUPS.USERCENTER, MQTT_PATTERNS.USER_CREATE))
  create(payload: CreateUserDto) {
    return this.usercenterService.create(payload);
  }
}
