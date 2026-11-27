import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { MQTT_PATTERNS, USER_CLIENT, WIKI_BIZ_CODE } from '@app/common';
import { callDownstream } from '../../common/downstream';

/** 编辑器登录：注册、账密、微信、支付宝、扫码、会话。业务码固定为 wiki。 */
@Injectable()
export class WikiAuthService implements OnModuleInit {
  constructor(@Inject(USER_CLIENT) private readonly users: ClientProxy) {}

  async onModuleInit() {
    await this.users.connect();
  }

  register(payload: Record<string, unknown>) {
    return this.call(MQTT_PATTERNS.AUTH_REGISTER, payload);
  }

  login(payload: Record<string, unknown>) {
    return this.call(MQTT_PATTERNS.AUTH_LOGIN, payload);
  }

  wechat(payload: Record<string, unknown>) {
    return this.call(MQTT_PATTERNS.AUTH_WECHAT, payload);
  }

  alipay(payload: Record<string, unknown>) {
    return this.call(MQTT_PATTERNS.AUTH_ALIPAY, payload);
  }

  refresh(payload: Record<string, unknown>) {
    return this.call(MQTT_PATTERNS.AUTH_REFRESH, payload);
  }

  logout(payload: Record<string, unknown>) {
    return this.call(MQTT_PATTERNS.AUTH_LOGOUT, payload);
  }

  me(payload: Record<string, unknown>) {
    return this.call(MQTT_PATTERNS.AUTH_ME, payload);
  }

  bindPhone(payload: Record<string, unknown>) {
    return this.call(MQTT_PATTERNS.AUTH_BIND_PHONE, payload);
  }

  changePassword(payload: Record<string, unknown>) {
    return this.call(MQTT_PATTERNS.AUTH_CHANGE_PASSWORD, payload);
  }

  createLoginQr(payload: Record<string, unknown>) {
    return this.call(MQTT_PATTERNS.AUTH_LOGIN_QR_CREATE, payload);
  }

  scanLoginQr(payload: Record<string, unknown>) {
    return this.call(MQTT_PATTERNS.AUTH_LOGIN_QR_SCAN, payload);
  }

  confirmLoginQr(payload: Record<string, unknown>) {
    return this.call(MQTT_PATTERNS.AUTH_LOGIN_QR_CONFIRM, payload);
  }

  loginQrStatus(payload: Record<string, unknown>) {
    return this.call(MQTT_PATTERNS.AUTH_LOGIN_QR_STATUS, payload);
  }

  private call(pattern: string, payload: Record<string, unknown>) {
    return callDownstream(this.users, pattern, { ...payload, _bizCode: WIKI_BIZ_CODE }, 15_000, '登录服务不可用');
  }
}
