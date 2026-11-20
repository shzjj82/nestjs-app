import { Injectable } from '@nestjs/common';
import { MQTT_PATTERNS } from '@app/common';
import { PlatformProxy } from '../platform-proxy';

/** 编辑器登录页：注册、账密、微信、支付宝、扫码、会话。业务码固定为 wiki。 */
@Injectable()
export class WikiAuthService {
  constructor(private readonly platform: PlatformProxy) {}

  register(payload: Record<string, unknown>) {
    return this.platform.callAuth(MQTT_PATTERNS.AUTH_REGISTER, payload);
  }

  login(payload: Record<string, unknown>) {
    return this.platform.callAuth(MQTT_PATTERNS.AUTH_LOGIN, payload);
  }

  wechat(payload: Record<string, unknown>) {
    return this.platform.callAuth(MQTT_PATTERNS.AUTH_WECHAT, payload);
  }

  alipay(payload: Record<string, unknown>) {
    return this.platform.callAuth(MQTT_PATTERNS.AUTH_ALIPAY, payload);
  }

  refresh(payload: Record<string, unknown>) {
    return this.platform.callAuth(MQTT_PATTERNS.AUTH_REFRESH, payload);
  }

  logout(payload: Record<string, unknown>) {
    return this.platform.callAuth(MQTT_PATTERNS.AUTH_LOGOUT, payload);
  }

  me(payload: Record<string, unknown>) {
    return this.platform.callAuth(MQTT_PATTERNS.AUTH_ME, payload);
  }

  bindPhone(payload: Record<string, unknown>) {
    return this.platform.callAuth(MQTT_PATTERNS.AUTH_BIND_PHONE, payload);
  }

  changePassword(payload: Record<string, unknown>) {
    return this.platform.callAuth(MQTT_PATTERNS.AUTH_CHANGE_PASSWORD, payload);
  }

  createLoginQr(payload: Record<string, unknown>) {
    return this.platform.callAuth(MQTT_PATTERNS.AUTH_LOGIN_QR_CREATE, payload);
  }

  scanLoginQr(payload: Record<string, unknown>) {
    return this.platform.callAuth(MQTT_PATTERNS.AUTH_LOGIN_QR_SCAN, payload);
  }

  confirmLoginQr(payload: Record<string, unknown>) {
    return this.platform.callAuth(MQTT_PATTERNS.AUTH_LOGIN_QR_CONFIRM, payload);
  }

  loginQrStatus(payload: Record<string, unknown>) {
    return this.platform.callAuth(MQTT_PATTERNS.AUTH_LOGIN_QR_STATUS, payload);
  }
}
