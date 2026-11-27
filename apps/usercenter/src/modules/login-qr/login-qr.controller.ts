import { Controller, UseInterceptors } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import {
  ApiDoc,
  MQTT_GROUPS,
  MQTT_PATTERNS,
  UsercenterHandleLogInterceptor,
  sharePattern,
} from '@app/common';
import { LoginQrService } from './login-qr.service';

@Controller()
@UseInterceptors(UsercenterHandleLogInterceptor)
export class LoginQrController {
  constructor(private readonly loginQr: LoginQrService) {}

  @MessagePattern(sharePattern(MQTT_GROUPS.USERCENTER, MQTT_PATTERNS.AUTH_LOGIN_QR_CREATE))
  @ApiDoc({
    name: '创建登录小程序码',
    description:
      'purpose=login。返回 MQTT topic 与 SSE 路径；与门店绑定码（purpose=bind）分离',
  })
  create(payload: Record<string, unknown>) {
    return this.loginQr.create(payload);
  }

  @MessagePattern(sharePattern(MQTT_GROUPS.USERCENTER, MQTT_PATTERNS.AUTH_LOGIN_QR_SCAN))
  @ApiDoc({
    name: '登录码已扫',
    description: '小程序打开登录页时调用，PC 端经 MQTT/SSE 收到 scanned',
  })
  scan(payload: Record<string, unknown>) {
    return this.loginQr.scan(payload);
  }

  @MessagePattern(sharePattern(MQTT_GROUPS.USERCENTER, MQTT_PATTERNS.AUTH_LOGIN_QR_CONFIRM))
  @ApiDoc({
    name: '确认扫码登录',
    description: '小程序用 code 换登录态后推送 confirmed + token',
  })
  confirm(payload: Record<string, unknown>) {
    return this.loginQr.confirm(payload);
  }

  @MessagePattern(sharePattern(MQTT_GROUPS.USERCENTER, MQTT_PATTERNS.AUTH_LOGIN_QR_STATUS))
  @ApiDoc({ name: '登录码状态', description: '轮询兜底；优先用 MQTT 或 SSE' })
  status(payload: Record<string, unknown>) {
    return this.loginQr.status(payload);
  }
}
