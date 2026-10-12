import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import {
  ApiDoc,
  MQTT_GROUPS,
  MQTT_PATTERNS,
  sharePattern,
} from '@app/common';
import { bizCodeOf, requireActor } from '../domain';
import { IdentityService } from './identity.service';

@Controller()
export class IdentityController {
  constructor(private readonly identity: IdentityService) {}

  @MessagePattern(sharePattern(MQTT_GROUPS.RECYCLE, MQTT_PATTERNS.RECYCLE_ME))
  @ApiDoc({
    name: '当前回收身份',
    description:
      '合并会话用户信息与当前账户在回收业务中的身份（角色 / 是否员工 / 绑定门店别名），不含手机号',
  })
  me(payload: Record<string, unknown>) {
    const actor = requireActor(payload);
    return this.identity.me(actor, bizCodeOf(payload, actor));
  }
}
