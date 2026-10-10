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
import { OrdersService } from './orders.service';

/**
 * 订单接口。
 *
 * 这里只做「取身份 → 取业务码 → 转发」，不写任何权限判断：
 * 权限由 PolicyModule 在服务端统一裁决。
 */
@Controller()
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @MessagePattern(
    sharePattern(MQTT_GROUPS.RECYCLE, MQTT_PATTERNS.RECYCLE_ORDER_FIND_ALL),
  )
  @ApiDoc({ name: '回收订单列表', description: '按调用者身份自动收窄数据范围' })
  findAll(payload: Record<string, unknown>) {
    const actor = requireActor(payload);
    return this.orders.list(actor, bizCodeOf(payload, actor), payload);
  }

  @MessagePattern(
    sharePattern(MQTT_GROUPS.RECYCLE, MQTT_PATTERNS.RECYCLE_ORDER_FIND_ONE),
  )
  @ApiDoc({ name: '回收订单详情', description: '含明细与当前可执行动作' })
  findOne(payload: Record<string, unknown>) {
    const actor = requireActor(payload);
    return this.orders.detail(
      actor,
      bizCodeOf(payload, actor),
      requiredString(payload.id, 'id'),
    );
  }

  @MessagePattern(
    sharePattern(MQTT_GROUPS.RECYCLE, MQTT_PATTERNS.RECYCLE_ORDER_CREATE),
  )
  @ApiDoc({
    name: '创建回收订单',
    description: '一次可提交多个不同品牌 / 类型的耗材',
  })
  create(payload: Record<string, unknown>) {
    const actor = requireActor(payload);
    return this.orders.create(actor, bizCodeOf(payload, actor), payload);
  }

  @MessagePattern(
    sharePattern(MQTT_GROUPS.RECYCLE, MQTT_PATTERNS.RECYCLE_ORDER_ACTION),
  )
  @ApiDoc({
    name: '执行订单动作',
    description:
      '动作 × 角色 × 起始状态由策略引擎裁决；不提供直接改 status 的接口',
  })
  action(payload: Record<string, unknown>) {
    const actor = requireActor(payload);
    return this.orders.perform(
      actor,
      bizCodeOf(payload, actor),
      requiredString(payload.id, 'id'),
      requiredString(payload.action, 'action'),
      payload,
    );
  }

  @MessagePattern(
    sharePattern(MQTT_GROUPS.RECYCLE, MQTT_PATTERNS.RECYCLE_ORDER_TIMELINE),
  )
  @ApiDoc({ name: '订单时间轴' })
  timeline(payload: Record<string, unknown>) {
    const actor = requireActor(payload);
    return this.orders.timeline(
      actor,
      bizCodeOf(payload, actor),
      requiredString(payload.id, 'id'),
    );
  }

  @MessagePattern(
    sharePattern(MQTT_GROUPS.RECYCLE, MQTT_PATTERNS.RECYCLE_ORDER_AUDIT),
  )
  @ApiDoc({ name: '订单验收报告' })
  audit(payload: Record<string, unknown>) {
    const actor = requireActor(payload);
    return this.orders.audit(
      actor,
      bizCodeOf(payload, actor),
      requiredString(payload.id, 'id'),
    );
  }

  /** 内部事件：审批出结论后回调订单（不注册到网关） */
  @MessagePattern(
    sharePattern(
      MQTT_GROUPS.RECYCLE,
      MQTT_PATTERNS.RECYCLE_EVT_APPROVAL_DECIDED,
    ),
  )
  onApprovalDecided(payload: Record<string, unknown>) {
    return this.orders.applyDecision(payload);
  }
}
