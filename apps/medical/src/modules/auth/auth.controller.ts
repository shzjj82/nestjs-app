import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import {
  ApiDoc,
  MQTT_GROUPS,
  MQTT_PATTERNS,
  requiredString,
  sharePattern,
} from '@app/common';
import { requireClinic } from '../../clinic';
import { AuthService } from './auth.service';

@Controller()
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @MessagePattern(
    sharePattern(MQTT_GROUPS.MEDICAL, MQTT_PATTERNS.MEDICAL_AUTH_LOGIN),
  )
  @ApiDoc({
    name: '诊所登录',
    description: '医生 / 医助账密登录，返回诊所 token（不是 usercenter JWT）',
  })
  login(payload: Record<string, unknown>) {
    return this.auth.login(
      requiredString(payload.username, '账号'),
      requiredString(payload.password, '密码'),
    );
  }

  @MessagePattern(
    sharePattern(MQTT_GROUPS.MEDICAL, MQTT_PATTERNS.MEDICAL_AUTH_ME),
  )
  @ApiDoc({ name: '当前诊所账号' })
  me(payload: Record<string, unknown>) {
    return requireClinic(this.auth, payload);
  }
}
