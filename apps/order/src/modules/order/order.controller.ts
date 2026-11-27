import { Controller } from '@nestjs/common';
import { MessagePattern, RpcException } from '@nestjs/microservices';
import { ApiDoc, MQTT_GROUPS, MQTT_PATTERNS, sharePattern } from '@app/common';
import { OrderService } from './order.service';

@Controller()
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @MessagePattern(sharePattern(MQTT_GROUPS.ORDER, MQTT_PATTERNS.ORDER_HEALTH))
  health() {
    return this.orderService.health();
  }

  @MessagePattern(sharePattern(MQTT_GROUPS.ORDER, MQTT_PATTERNS.ORDER_FIND_ALL))
  @ApiDoc({ name: '订单列表' })
  findAll(payload: unknown) {
    return this.orderService.findAll(payload);
  }

  @MessagePattern(sharePattern(MQTT_GROUPS.ORDER, MQTT_PATTERNS.ORDER_FIND_ONE))
  @ApiDoc({ name: '订单详情' })
  async findOne(payload: { id: string }) {
    const order = await this.orderService.findOne(payload);
    if (!order) {
      throw new RpcException({ status: 404, message: `订单 ${payload.id} 不存在` });
    }
    return order;
  }

  @MessagePattern(sharePattern(MQTT_GROUPS.ORDER, MQTT_PATTERNS.ORDER_CREATE))
  @ApiDoc({ name: '创建订单', description: '订单归属于当前登录账户' })
  create(payload: unknown) {
    return this.orderService.create(payload);
  }
}
