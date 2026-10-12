import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import {
  ApiDoc,
  MQTT_GROUPS,
  MQTT_PATTERNS,
  sharePattern,
} from '@app/common';
import { ORDER_STATUS_LABELS } from '../domain';
import { OrderPolicyService } from './policy.service';

@Controller()
export class PolicyController {
  constructor(private readonly policy: OrderPolicyService) {}

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
