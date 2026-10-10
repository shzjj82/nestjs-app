import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import {
  ApiDoc,
  MQTT_GROUPS,
  MQTT_PATTERNS,
  requiredString,
  sharePattern,
} from '@app/common';
import { bizCodeOf, requireActor } from '../domain';
import { ApprovalsService } from './approvals.service';

@Controller()
export class ApprovalsController {
  constructor(private readonly approvals: ApprovalsService) {}

  @MessagePattern(
    sharePattern(MQTT_GROUPS.RECYCLE, MQTT_PATTERNS.RECYCLE_APPROVAL_FIND_ALL),
  )
  @ApiDoc({ name: '审批待办列表' })
  findAll(payload: Record<string, unknown>) {
    const actor = requireActor(payload);
    return this.approvals.list(actor, bizCodeOf(payload, actor), payload);
  }

  @MessagePattern(
    sharePattern(MQTT_GROUPS.RECYCLE, MQTT_PATTERNS.RECYCLE_APPROVAL_FIND_ONE),
  )
  @ApiDoc({ name: '审批任务详情' })
  findOne(payload: Record<string, unknown>) {
    const actor = requireActor(payload);
    return this.approvals.detail(
      actor,
      bizCodeOf(payload, actor),
      requiredString(payload.id, 'id'),
    );
  }

  @MessagePattern(
    sharePattern(MQTT_GROUPS.RECYCLE, MQTT_PATTERNS.RECYCLE_APPROVAL_DECIDE),
  )
  @ApiDoc({ name: '出具审批结论', description: 'accept / reject / reprice' })
  decide(payload: Record<string, unknown>) {
    const actor = requireActor(payload);
    return this.approvals.decide(
      actor,
      bizCodeOf(payload, actor),
      requiredString(payload.id, 'id'),
      payload,
    );
  }

  @MessagePattern(
    sharePattern(MQTT_GROUPS.RECYCLE, MQTT_PATTERNS.RECYCLE_APPROVAL_CANCEL),
  )
  @ApiDoc({ name: '取消审批任务' })
  cancel(payload: Record<string, unknown>) {
    const actor = requireActor(payload);
    return this.approvals.cancel(
      actor,
      bizCodeOf(payload, actor),
      requiredString(payload.id, 'id'),
      payload,
    );
  }

  @MessagePattern(
    sharePattern(MQTT_GROUPS.RECYCLE, MQTT_PATTERNS.RECYCLE_APPROVAL_RECORDS),
  )
  @ApiDoc({ name: '审批留痕记录' })
  records(payload: Record<string, unknown>) {
    const actor = requireActor(payload);
    return this.approvals.records(
      actor,
      bizCodeOf(payload, actor),
      requiredString(payload.id, 'id'),
    );
  }

  /** 内部事件：订单侧请求审批（不注册到网关） */
  @MessagePattern(
    sharePattern(
      MQTT_GROUPS.RECYCLE,
      MQTT_PATTERNS.RECYCLE_EVT_APPROVAL_REQUESTED,
    ),
  )
  onApprovalRequested(payload: Record<string, unknown>) {
    return this.approvals.request(payload);
  }
}
