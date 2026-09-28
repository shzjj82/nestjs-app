import { Controller, UseInterceptors } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { MQTT_PATTERNS, WechatHandleLogInterceptor } from '@app/common';
import { wechatPattern } from '../common/rpc';
import { WechatApiService } from './wechat-api.service';

@Controller()
@UseInterceptors(WechatHandleLogInterceptor)
export class WechatApiController {
  constructor(private readonly api: WechatApiService) {}

  @MessagePattern(wechatPattern(MQTT_PATTERNS.WECHAT_CODE2SESSION))
  code2session(payload: Record<string, unknown>) {
    return this.api.code2session(payload);
  }

  @MessagePattern(wechatPattern(MQTT_PATTERNS.WECHAT_QRCODE))
  qrcode(payload: Record<string, unknown>) {
    return this.api.qrcode(payload);
  }

  @MessagePattern(wechatPattern(MQTT_PATTERNS.WECHAT_PHONE))
  phone(payload: Record<string, unknown>) {
    return this.api.phone(payload);
  }
}
