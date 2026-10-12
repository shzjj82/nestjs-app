import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import {
  ApiDoc,
  MQTT_GROUPS,
  MQTT_PATTERNS,
  serviceHealth,
  sharePattern,
} from '@app/common';
import { bizCodeOf, ORDER_STATUS_LABELS, requireActor } from './domain';
import { IdentityService } from './identity/identity.service';
import { OrderPolicyService } from './policy/policy.service';

@Controller()
export class RecycleController {
  constructor(
    private readonly policy: OrderPolicyService,
    private readonly identity: IdentityService,
  ) {}

  @MessagePattern(
    sharePattern(MQTT_GROUPS.RECYCLE, MQTT_PATTERNS.RECYCLE_HEALTH),
  )
  @ApiDoc({ name: '回收服务健康检查' })
  health() {
    return serviceHealth('recycle');
  }

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

  /**
   * 状态机与授权矩阵全量描述。
   * 管理端渲染流程图 / 权限矩阵用，避免前端硬编码。
   */
  @MessagePattern(
    sharePattern(MQTT_GROUPS.RECYCLE, MQTT_PATTERNS.RECYCLE_POLICY_TRANSITIONS),
  )
  @ApiDoc({ name: '回收状态机与授权矩阵' })
  transitions() {
    return {
      statuses: ORDER_STATUS_LABELS,
      transitions: this.policy.describe(),
    };
  }
}
