import {
  BadRequestException,
  Body,
  Controller,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { MQTT_PATTERNS, ORDER_CLIENT } from '@app/common';
import type { CreateOrderDto, Order, ServiceEnvelope } from '@app/common';
import type { Request } from 'express';
import { BizGuard } from '../auth/biz.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { GatewayUser } from '../auth/auth.types';
import { ClientHub } from '../mqtt/client.hub';

@Controller('orders')
export class OrdersOverrideController {
  constructor(
    private readonly clients: ClientHub,
    private readonly biz: BizGuard,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(
    @Req() req: Request,
    @Body() body: CreateOrderDto,
    @CurrentUser() user: GatewayUser,
  ) {
    const bizCode = await this.biz.checkRequest(req, user);
    const items = (body as { items?: unknown }).items;
    const hasItems = Array.isArray(items) && items.length > 0;
    if (!user.accountId) {
      throw new BadRequestException('当前会话没有账户');
    }
    if (!body?.item?.trim() && !hasItems) {
      throw new BadRequestException('item 或 items 必填');
    }

    return this.clients.send<ServiceEnvelope<Order>>(
      ORDER_CLIENT,
      MQTT_PATTERNS.ORDER_CREATE,
      {
        ...body,
        _bizCode: bizCode,
        _session: {
          accountId: user.accountId,
          appId: user.appId,
          bizCode: user.bizCode ?? bizCode ?? '',
        },
      },
    );
  }
}
