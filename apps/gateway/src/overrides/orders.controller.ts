import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UseGuards,
} from '@nestjs/common';
import { MQTT_PATTERNS, ORDER_CLIENT } from '@app/common';
import type { CreateOrderDto, Order, ServiceEnvelope } from '@app/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { GatewayUser } from '../auth/auth.types';
import { ClientHub } from '../mqtt/client.hub';

@Controller('orders')
export class OrdersOverrideController {
  constructor(private readonly clients: ClientHub) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() body: CreateOrderDto, @CurrentUser() user: GatewayUser) {
    if (!body?.userId || !body?.item?.trim() || body.amount == null) {
      throw new BadRequestException('userId、item、amount 必填');
    }

    return this.clients.send<ServiceEnvelope<Order>>(
      ORDER_CLIENT,
      MQTT_PATTERNS.ORDER_CREATE,
      {
        ...body,
        operatorId: user.id,
      },
    );
  }
}
