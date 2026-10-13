import { Controller, UseInterceptors } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { ApiDoc, MQTT_PATTERNS, WechatHandleLogInterceptor } from '@app/common';
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

  @ApiDoc({ name: '生成小程序码', description: '按小程序生成场景码图片' })
  @MessagePattern(wechatPattern(MQTT_PATTERNS.WECHAT_QRCODE))
  qrcode(payload: Record<string, unknown>) {
    return this.api.qrcode(payload);
  }

  @MessagePattern(wechatPattern(MQTT_PATTERNS.WECHAT_PHONE))
  @ApiDoc({ name: '获取微信手机号', description: '用 getPhoneNumber 的 code 换手机号' })
  phone(payload: Record<string, unknown>) {
    return this.api.phone(payload);
  }

  @MessagePattern(wechatPattern(MQTT_PATTERNS.WECHAT_SUBSCRIBE_TEMPLATES))
  @ApiDoc({
    name: '订阅消息模板清单',
    description: '按场景返回模板 ID；未配置的场景为空串，前端须跳过',
  })
  subscribeTemplates(payload: Record<string, unknown>) {
    return this.api.subscribeTemplates(payload);
  }

  /**
   * 发送订阅消息。业务服务（如回收）通过 MQTT 内部调用，不走网关。
   * 入参只带场景名，模板 ID 由本服务按小程序配置补全。
   */
  @MessagePattern(wechatPattern(MQTT_PATTERNS.WECHAT_SUBSCRIBE_SEND))
  @ApiDoc({ name: '发送订阅消息', description: '内部接口：业务服务通知用户' })
  sendSubscribe(payload: Record<string, unknown>) {
    return this.api.sendSubscribe(payload);
  }
}
