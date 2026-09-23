import { Injectable } from '@nestjs/common';
import type { CreateOrderDto, Order } from '@app/common';

@Injectable()
export class OrderService {
  private readonly orders = new Map<string, Order>();

  health() {
    return { status: 'ok' };
  }

  findAll(): Order[] {
    return [...this.orders.values()];
  }

  findOne(id: string): Order | null {
    return this.orders.get(id) ?? null;
  }

  create(dto: CreateOrderDto): Order {
    const order: Order = {
      id: `o-${Date.now()}`,
      userId: dto.userId,
      item: dto.item.trim(),
      amount: Number(dto.amount),
    };
    this.orders.set(order.id, order);
    return order;
  }
}
