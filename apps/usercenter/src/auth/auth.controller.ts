import { Controller, UseInterceptors } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { MQTT_PATTERNS } from '@app/common';
import { HandleLogInterceptor } from '../handle-log.interceptor';
import { ucPattern } from '../rpc';
import { AuthService } from './auth.service';

@Controller()
@UseInterceptors(HandleLogInterceptor)
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @MessagePattern(ucPattern(MQTT_PATTERNS.AUTH_REGISTER))
  register(payload: Record<string, unknown>) {
    return this.auth.register(payload);
  }

  @MessagePattern(ucPattern(MQTT_PATTERNS.AUTH_LOGIN))
  login(payload: Record<string, unknown>) {
    return this.auth.login(payload);
  }

  @MessagePattern(ucPattern(MQTT_PATTERNS.AUTH_WECHAT))
  wechat(payload: Record<string, unknown>) {
    return this.auth.loginByWechat(payload);
  }

  @MessagePattern(ucPattern(MQTT_PATTERNS.AUTH_ALIPAY))
  alipay(payload: Record<string, unknown>) {
    return this.auth.loginByAlipay(payload);
  }

  @MessagePattern(ucPattern(MQTT_PATTERNS.AUTH_REFRESH))
  refresh(payload: Record<string, unknown>) {
    return this.auth.refresh(payload);
  }

  @MessagePattern(ucPattern(MQTT_PATTERNS.AUTH_LOGOUT))
  logout(payload: Record<string, unknown>) {
    return this.auth.logout(payload);
  }

  @MessagePattern(ucPattern(MQTT_PATTERNS.AUTH_ME))
  me(payload: Record<string, unknown>) {
    return this.auth.me(payload);
  }

  @MessagePattern(ucPattern(MQTT_PATTERNS.AUTH_BIND_PHONE))
  bindPhone(payload: Record<string, unknown>) {
    return this.auth.bindPhone(payload);
  }
}
