import { Controller, Inject } from '@nestjs/common';
import { ClientProxy, MessagePattern, RpcException } from '@nestjs/microservices';
import { lastValueFrom, TimeoutError } from 'rxjs';
import { timeout } from 'rxjs/operators';
import {
  MQTT_GROUPS,
  MQTT_PATTERNS,
  sharePattern,
  USER_CLIENT,
} from '@app/common';
import type { CreateOrderDto, User } from '@app/common';
import { OrderService } from './order.service';

@Controller()
export class OrderController {
  constructor(
    private readonly orderService: OrderService,
    @Inject(USER_CLIENT) private readonly userClient: ClientProxy,
  ) {}

  @MessagePattern(sharePattern(MQTT_GROUPS.ORDER, MQTT_PATTERNS.ORDER_HEALTH))
  health() {
    return this.orderService.health();
  }

  @MessagePattern(sharePattern(MQTT_GROUPS.ORDER, MQTT_PATTERNS.ORDER_FIND_ALL))
  findAll() {
    return this.orderService.findAll();
  }

  @MessagePattern(sharePattern(MQTT_GROUPS.ORDER, MQTT_PATTERNS.ORDER_FIND_ONE))
  findOne(payload: { id: string }) {
    const order = this.orderService.findOne(payload.id);
    if (!order) {
      throw new RpcException({ status: 404, message: `订单 ${payload.id} 不存在` });
    }
    return order;
  }

  @MessagePattern(sharePattern(MQTT_GROUPS.ORDER, MQTT_PATTERNS.ORDER_CREATE))
  async create(payload: CreateOrderDto) {
    await this.assertUserExists(payload.userId);
    return this.orderService.create(payload);
  }

  private async assertUserExists(userId: string) {
    try {
      const user = await lastValueFrom(
        this.userClient
          .send<ServiceEnvelope<User>>(MQTT_PATTERNS.USER_FIND_ONE, { id: userId })
          .pipe(timeout(5000)),
      );
      if (!user?.data) {
        throw new RpcException({ status: 404, message: `用户 ${userId} 不存在` });
      }
    } catch (err) {
      if (err instanceof RpcException) {
        throw err;
      }
      if (err instanceof TimeoutError) {
        throw new RpcException({ status: 504, message: '校验用户超时' });
      }
      const payload = err as { status?: number; message?: string };
      throw new RpcException({
        status: payload?.status ?? 502,
        message: payload?.message ?? '无法校验用户',
      });
    }
  }
}
