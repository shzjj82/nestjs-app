import { Controller, UseInterceptors } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { MQTT_PATTERNS, serviceHealth, WechatHandleLogInterceptor, sharePattern, MQTT_GROUPS } from '@app/common';

@Controller()
@UseInterceptors(WechatHandleLogInterceptor)
export class WechatController {
  @MessagePattern(sharePattern(MQTT_GROUPS.WECHAT, MQTT_PATTERNS.WECHAT_HEALTH))
  health() {
    return serviceHealth('wechat');
  }
}
