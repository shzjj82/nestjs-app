import { Controller, UseInterceptors } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { ApiDoc, MQTT_PATTERNS, UsercenterHandleLogInterceptor } from '@app/common';
import { ucPattern } from '../rpc';
import { AuthService } from './auth.service';

@Controller()
@UseInterceptors(UsercenterHandleLogInterceptor)
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @MessagePattern(ucPattern(MQTT_PATTERNS.AUTH_REGISTER))
  @ApiDoc({ name: '注册用户', description: '账密注册到当前业务；手机号可选' })
  register(payload: Record<string, unknown>) {
    return this.auth.register(payload);
  }

  @MessagePattern(ucPattern(MQTT_PATTERNS.AUTH_LOGIN))
  @ApiDoc({ name: '用户登录', description: '账密登录，username 可填手机号' })
  login(payload: Record<string, unknown>) {
    return this.auth.login(payload);
  }

  @MessagePattern(ucPattern(MQTT_PATTERNS.AUTH_WECHAT))
  @ApiDoc({ name: '微信登录', description: '微信小程序 code 换取登录态' })
  wechat(payload: Record<string, unknown>) {
    return this.auth.loginByWechat(payload);
  }

  @MessagePattern(ucPattern(MQTT_PATTERNS.AUTH_ALIPAY))
  @ApiDoc({ name: '支付宝登录', description: '支付宝小程序 authCode 换取登录态' })
  alipay(payload: Record<string, unknown>) {
    return this.auth.loginByAlipay(payload);
  }

  @MessagePattern(ucPattern(MQTT_PATTERNS.AUTH_REFRESH))
  @ApiDoc({ name: '刷新登录令牌', description: '用 refresh token 换一对新的令牌' })
  refresh(payload: Record<string, unknown>) {
    return this.auth.refresh(payload);
  }

  @MessagePattern(ucPattern(MQTT_PATTERNS.AUTH_LOGOUT))
  logout(payload: Record<string, unknown>) {
    return this.auth.logout(payload);
  }

  @MessagePattern(ucPattern(MQTT_PATTERNS.AUTH_ME))
  @ApiDoc({ name: '用户详情', description: '当前登录用户的资料、角色与功能点' })
  me(payload: Record<string, unknown>) {
    return this.auth.me(payload);
  }

  @MessagePattern(ucPattern(MQTT_PATTERNS.AUTH_BIND_PHONE))
  @ApiDoc({ name: '绑定手机号', description: '当前用户绑定手机号，占用时合并账号' })
  bindPhone(payload: Record<string, unknown>) {
    return this.auth.bindPhone(payload);
  }

  @MessagePattern(ucPattern(MQTT_PATTERNS.AUTH_CHANGE_PASSWORD))
  @ApiDoc({ name: '修改密码', description: '校验旧密码后设置新密码' })
  changePassword(payload: Record<string, unknown>) {
    return this.auth.changePassword(payload);
  }
}
