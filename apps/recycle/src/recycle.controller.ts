import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import {
  ApiDoc,
  MQTT_GROUPS,
  MQTT_PATTERNS,
  serviceHealth,
  sharePattern,
} from '@app/common';
import { ORDER_STATUS_LABELS } from './domain';
import { OrderPolicyService } from './policy/policy.service';

@Controller()
export class RecycleController {
  constructor(private readonly policy: OrderPolicyService) {}

  @MessagePattern(
    sharePattern(MQTT_GROUPS.RECYCLE, MQTT_PATTERNS.RECYCLE_HEALTH),
  )
  @ApiDoc({ name: '回收服务健康检查' })
  health() {
    return serviceHealth('recycle');
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
