import { Controller, UseInterceptors } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import {
  ApiDoc,
  DocsHandleLogInterceptor,
  MQTT_GROUPS,
  MQTT_PATTERNS,
  sharePattern,
} from '@app/common';
import { WikiAuthService } from './auth.service';

@Controller()
@UseInterceptors(DocsHandleLogInterceptor)
export class WikiAuthController {
  constructor(private readonly auth: WikiAuthService) {}

  @MessagePattern(sharePattern(MQTT_GROUPS.WIKI, MQTT_PATTERNS.WIKI_AUTH_REGISTER))
  @ApiDoc({ name: 'Wiki 注册', description: '编辑器注册，注入 bizCode=wiki 后转发 usercenter' })
  register(payload: Record<string, unknown>) {
    return this.auth.register(payload);
  }

  @MessagePattern(sharePattern(MQTT_GROUPS.WIKI, MQTT_PATTERNS.WIKI_AUTH_LOGIN))
  @ApiDoc({ name: 'Wiki 登录', description: '编辑器登录，注入 bizCode=wiki 后转发 usercenter' })
  login(payload: Record<string, unknown>) {
    return this.auth.login(payload);
  }

  @MessagePattern(sharePattern(MQTT_GROUPS.WIKI, MQTT_PATTERNS.WIKI_AUTH_WECHAT))
  wechat(payload: Record<string, unknown>) {
    return this.auth.wechat(payload);
  }

  @MessagePattern(sharePattern(MQTT_GROUPS.WIKI, MQTT_PATTERNS.WIKI_AUTH_ALIPAY))
  alipay(payload: Record<string, unknown>) {
    return this.auth.alipay(payload);
  }

  @MessagePattern(sharePattern(MQTT_GROUPS.WIKI, MQTT_PATTERNS.WIKI_AUTH_REFRESH))
  refresh(payload: Record<string, unknown>) {
    return this.auth.refresh(payload);
  }

  @MessagePattern(sharePattern(MQTT_GROUPS.WIKI, MQTT_PATTERNS.WIKI_AUTH_LOGOUT))
  logout(payload: Record<string, unknown>) {
    return this.auth.logout(payload);
  }

  @MessagePattern(sharePattern(MQTT_GROUPS.WIKI, MQTT_PATTERNS.WIKI_AUTH_ME))
  me(payload: Record<string, unknown>) {
    return this.auth.me(payload);
  }

  @MessagePattern(sharePattern(MQTT_GROUPS.WIKI, MQTT_PATTERNS.WIKI_AUTH_BIND_PHONE))
  bindPhone(payload: Record<string, unknown>) {
    return this.auth.bindPhone(payload);
  }

  @MessagePattern(sharePattern(MQTT_GROUPS.WIKI, MQTT_PATTERNS.WIKI_AUTH_CHANGE_PASSWORD))
  changePassword(payload: Record<string, unknown>) {
    return this.auth.changePassword(payload);
  }

  @MessagePattern(sharePattern(MQTT_GROUPS.WIKI, MQTT_PATTERNS.WIKI_AUTH_LOGIN_QR_CREATE))
  createLoginQr(payload: Record<string, unknown>) {
    return this.auth.createLoginQr(payload);
  }

  @MessagePattern(sharePattern(MQTT_GROUPS.WIKI, MQTT_PATTERNS.WIKI_AUTH_LOGIN_QR_SCAN))
  scanLoginQr(payload: Record<string, unknown>) {
    return this.auth.scanLoginQr(payload);
  }

  @MessagePattern(sharePattern(MQTT_GROUPS.WIKI, MQTT_PATTERNS.WIKI_AUTH_LOGIN_QR_CONFIRM))
  confirmLoginQr(payload: Record<string, unknown>) {
    return this.auth.confirmLoginQr(payload);
  }

  @MessagePattern(sharePattern(MQTT_GROUPS.WIKI, MQTT_PATTERNS.WIKI_AUTH_LOGIN_QR_STATUS))
  loginQrStatus(payload: Record<string, unknown>) {
    return this.auth.loginQrStatus(payload);
  }
}
