import { Controller, UseInterceptors } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { MQTT_PATTERNS, serviceHealth, WechatHandleLogInterceptor } from '@app/common';
import { wechatPattern } from './common/rpc';

@Controller()
@UseInterceptors(WechatHandleLogInterceptor)
export class WechatController {
  @MessagePattern(wechatPattern(MQTT_PATTERNS.WECHAT_HEALTH))
  health() {
    return serviceHealth('wechat');
  }
}
