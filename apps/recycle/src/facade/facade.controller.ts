import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { ApiDoc, MQTT_GROUPS, MQTT_PATTERNS, sharePattern } from '@app/common';
import { AuthProxy } from './auth-proxy';

/**
 * 回收产品登录门面：HTTP /recycle/auth/* → 本服务 → usercenter。
 * 强制 bizCode=recycle，前端无需带 X-Biz-Code。
 */
@Controller()
export class FacadeController {
  constructor(private readonly auth: AuthProxy) {}

  @MessagePattern(sharePattern(MQTT_GROUPS.RECYCLE, MQTT_PATTERNS.RECYCLE_AUTH_REGISTER))
  @ApiDoc({ name: '回收注册', description: '回收注册，注入 bizCode=recycle 后转发 usercenter' })
  authRegister(payload: Record<string, unknown>) {
    return this.auth.callAuth(MQTT_PATTERNS.AUTH_REGISTER, payload);
  }

  @MessagePattern(sharePattern(MQTT_GROUPS.RECYCLE, MQTT_PATTERNS.RECYCLE_AUTH_LOGIN))
  @ApiDoc({ name: '回收登录', description: '回收账密登录，注入 bizCode=recycle 后转发 usercenter' })
  authLogin(payload: Record<string, unknown>) {
    return this.auth.callAuth(MQTT_PATTERNS.AUTH_LOGIN, payload);
  }

  @MessagePattern(sharePattern(MQTT_GROUPS.RECYCLE, MQTT_PATTERNS.RECYCLE_AUTH_WECHAT))
  @ApiDoc({ name: '回收微信登录', description: '回收微信小程序登录，注入 bizCode=recycle 后转发 usercenter' })
  authWechat(payload: Record<string, unknown>) {
    return this.auth.callAuth(MQTT_PATTERNS.AUTH_WECHAT, payload);
  }

  @MessagePattern(sharePattern(MQTT_GROUPS.RECYCLE, MQTT_PATTERNS.RECYCLE_AUTH_ALIPAY))
  authAlipay(payload: Record<string, unknown>) {
    return this.auth.callAuth(MQTT_PATTERNS.AUTH_ALIPAY, payload);
  }

  @MessagePattern(sharePattern(MQTT_GROUPS.RECYCLE, MQTT_PATTERNS.RECYCLE_AUTH_REFRESH))
  authRefresh(payload: Record<string, unknown>) {
    return this.auth.callAuth(MQTT_PATTERNS.AUTH_REFRESH, payload);
  }

  @MessagePattern(sharePattern(MQTT_GROUPS.RECYCLE, MQTT_PATTERNS.RECYCLE_AUTH_LOGOUT))
  authLogout(payload: Record<string, unknown>) {
    return this.auth.callAuth(MQTT_PATTERNS.AUTH_LOGOUT, payload);
  }

  @MessagePattern(sharePattern(MQTT_GROUPS.RECYCLE, MQTT_PATTERNS.RECYCLE_AUTH_ME))
  authMe(payload: Record<string, unknown>) {
    return this.auth.callAuth(MQTT_PATTERNS.AUTH_ME, payload);
  }

  @MessagePattern(sharePattern(MQTT_GROUPS.RECYCLE, MQTT_PATTERNS.RECYCLE_AUTH_BIND_PHONE))
  authBindPhone(payload: Record<string, unknown>) {
    return this.auth.callAuth(MQTT_PATTERNS.AUTH_BIND_PHONE, payload);
  }

  @MessagePattern(sharePattern(MQTT_GROUPS.RECYCLE, MQTT_PATTERNS.RECYCLE_AUTH_CHANGE_PASSWORD))
  authChangePassword(payload: Record<string, unknown>) {
    return this.auth.callAuth(MQTT_PATTERNS.AUTH_CHANGE_PASSWORD, payload);
  }

  @MessagePattern(sharePattern(MQTT_GROUPS.RECYCLE, MQTT_PATTERNS.RECYCLE_AUTH_LOGIN_QR_CREATE))
  authQrCreate(payload: Record<string, unknown>) {
    return this.auth.callAuth(MQTT_PATTERNS.AUTH_LOGIN_QR_CREATE, payload);
  }

  @MessagePattern(sharePattern(MQTT_GROUPS.RECYCLE, MQTT_PATTERNS.RECYCLE_AUTH_LOGIN_QR_SCAN))
  authQrScan(payload: Record<string, unknown>) {
    return this.auth.callAuth(MQTT_PATTERNS.AUTH_LOGIN_QR_SCAN, payload);
  }

  @MessagePattern(sharePattern(MQTT_GROUPS.RECYCLE, MQTT_PATTERNS.RECYCLE_AUTH_LOGIN_QR_CONFIRM))
  authQrConfirm(payload: Record<string, unknown>) {
    return this.auth.callAuth(MQTT_PATTERNS.AUTH_LOGIN_QR_CONFIRM, payload);
  }

  @MessagePattern(sharePattern(MQTT_GROUPS.RECYCLE, MQTT_PATTERNS.RECYCLE_AUTH_LOGIN_QR_STATUS))
  authQrStatus(payload: Record<string, unknown>) {
    return this.auth.callAuth(MQTT_PATTERNS.AUTH_LOGIN_QR_STATUS, payload);
  }
}
