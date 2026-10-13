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
    sharePattern(MQTT_GROUPS.RECYCLE, MQTT_PATTERNS.RECYCLE_ORDER_FIND_MINE),
  )
  @ApiDoc({
    name: '我的回收订单',
    description: '客户视角：只返回当前用户自己的单（个人中心）',
  })
  findMine(payload: Record<string, unknown>) {
    const actor = requireActor(payload);
    return this.orders.listMine(actor, bizCodeOf(payload, actor), payload);
  }

  @MessagePattern(
    sharePattern(MQTT_GROUPS.RECYCLE, MQTT_PATTERNS.RECYCLE_ORDER_FIND_STAFF),
  )
  @ApiDoc({
    name: '业务员订单列表',
    description:
      '业务员视角：业务内工作单；需业务员/超管身份（agent/inspector/approver/finance 均视为业务员）',
  })
  findStaff(payload: Record<string, unknown>) {
    const actor = requireActor(payload);
    return this.orders.listStaff(actor, bizCodeOf(payload, actor), payload);
  }

  @MessagePattern(
    sharePattern(MQTT_GROUPS.RECYCLE, MQTT_PATTERNS.RECYCLE_ORDER_FIND_ALL),
  )
  @ApiDoc({
    name: '回收订单列表（兼容）',
    description:
      '有业务员身份走工作台，否则走个人单；新客户端请用 /orders/mine 或 /orders/staff',
  })
  findAll(payload: Record<string, unknown>) {
    const actor = requireActor(payload);
    return this.orders.list(actor, bizCodeOf(payload, actor), payload);
  }

  @MessagePattern(
    sharePattern(MQTT_GROUPS.RECYCLE, MQTT_PATTERNS.RECYCLE_ORDER_FIND_MINE_ONE),
  )
  @ApiDoc({ name: '我的订单详情', description: '顾客权限按钮' })
  findMineOne(payload: Record<string, unknown>) {
    return this.findOne({ ...payload, view: 'mine' });
  }

  @MessagePattern(
    sharePattern(MQTT_GROUPS.RECYCLE, MQTT_PATTERNS.RECYCLE_ORDER_FIND_STAFF_ONE),
  )
  @ApiDoc({ name: '工作台订单详情', description: '业务员权限按钮' })
  findStaffOne(payload: Record<string, unknown>) {
    return this.findOne({ ...payload, view: 'staff' });
  }

  @MessagePattern(
    sharePattern(MQTT_GROUPS.RECYCLE, MQTT_PATTERNS.RECYCLE_ORDER_FIND_ONE),
  )
  @ApiDoc({
    name: '回收订单详情',
    description:
      '含明细与当前可执行动作；view=mine 仅顾客按钮，view=staff 仅业务员按钮',
  })
  findOne(payload: Record<string, unknown>) {
    const actor = requireActor(payload);
    return this.orders.detail(
      actor,
      bizCodeOf(payload, actor),
      requiredString(payload.id, 'id'),
      payload,
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
      'view=mine|customer 走顾客权限，view=staff 走业务员权限；路径 /orders/mine/:id 与 /orders/staff/:id 会带上 view',
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
    sharePattern(MQTT_GROUPS.RECYCLE, MQTT_PATTERNS.RECYCLE_ORDER_ACTION_MINE),
  )
  @ApiDoc({
    name: '我的订单-执行动作',
    description: '客户视角：接受/拒绝报价、协商等',
  })
  actionMine(payload: Record<string, unknown>) {
    return this.action({ ...payload, view: 'mine' });
  }

  @MessagePattern(
    sharePattern(MQTT_GROUPS.RECYCLE, MQTT_PATTERNS.RECYCLE_ORDER_ACTION_STAFF),
  )
  @ApiDoc({
    name: '工作台订单-执行动作',
    description: '业务员视角：收货、验收、打款、退货等',
  })
  actionStaff(payload: Record<string, unknown>) {
    return this.action({ ...payload, view: 'staff' });
  }

  @MessagePattern(
    sharePattern(
      MQTT_GROUPS.RECYCLE,
      MQTT_PATTERNS.RECYCLE_ORDER_MERCHANT_TRANSFER,
    ),
  )
  @ApiDoc({
    name: '商家转账确认收款参数',
    description:
      '订单本人拉取 mchId/appId/package，供小程序 wx.requestMerchantTransfer',
  })
  merchantTransfer(payload: Record<string, unknown>) {
    const actor = requireActor(payload);
    return this.orders.merchantTransfer(
      actor,
      bizCodeOf(payload, actor),
      requiredString(payload.id, 'id'),
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
      payload,
    );
  }

  @MessagePattern(
    sharePattern(MQTT_GROUPS.RECYCLE, MQTT_PATTERNS.RECYCLE_ORDER_TIMELINE_MINE),
  )
  @ApiDoc({ name: '我的订单-时间轴', description: '客户视角订单流转记录' })
  timelineMine(payload: Record<string, unknown>) {
    return this.timeline({ ...payload, view: 'mine' });
  }

  @MessagePattern(
    sharePattern(MQTT_GROUPS.RECYCLE, MQTT_PATTERNS.RECYCLE_ORDER_TIMELINE_STAFF),
  )
  @ApiDoc({ name: '工作台订单-时间轴', description: '业务员视角订单流转记录' })
  timelineStaff(payload: Record<string, unknown>) {
    return this.timeline({ ...payload, view: 'staff' });
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
      payload,
    );
  }

  @MessagePattern(
    sharePattern(MQTT_GROUPS.RECYCLE, MQTT_PATTERNS.RECYCLE_ORDER_AUDIT_MINE),
  )
  @ApiDoc({ name: '我的订单-验收报告', description: '客户视角验收报告' })
  auditMine(payload: Record<string, unknown>) {
    return this.audit({ ...payload, view: 'mine' });
  }

  @MessagePattern(
    sharePattern(MQTT_GROUPS.RECYCLE, MQTT_PATTERNS.RECYCLE_ORDER_AUDIT_STAFF),
  )
  @ApiDoc({ name: '工作台订单-验收报告', description: '业务员视角验收报告' })
  auditStaff(payload: Record<string, unknown>) {
    return this.audit({ ...payload, view: 'staff' });
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
