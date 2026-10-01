import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { Repository } from 'typeorm';
import { asRecord, optionalString, rpcFail, serviceHealth } from '@app/common';
import { OrderItemEntity } from './entities/order-item.entity';
import { OrderEntity } from './entities/order.entity';

const ORDER_STATUSES = new Set(['pending', 'paid', 'completed', 'cancelled', 'closed']);

type Line = { name: string; quantity: number; price: number; amount: number };

@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(OrderEntity) private readonly orders: Repository<OrderEntity>,
    @InjectRepository(OrderItemEntity) private readonly items: Repository<OrderItemEntity>,
  ) {}

  health() {
    return serviceHealth('order');
  }

  async findAll(payload: unknown) {
    const bizCode = optionalString(asRecord(payload)._bizCode);
    if (!bizCode) rpcFail(400, '缺少业务标识');
    const rows = await this.orders.find({
      where: { bizCode },
      relations: { items: true },
      order: { createdAt: 'DESC' },
    });
    return rows.map((row) => this.toView(row));
  }

  async findOne(payload: unknown) {
    const body = asRecord(payload);
    const bizCode = optionalString(body._bizCode);
    const id = optionalString(body.id);
    if (!bizCode) rpcFail(400, '缺少业务标识');
    if (!id) rpcFail(400, '缺少订单号');
    const row = await this.orders.findOne({ where: { id, bizCode }, relations: { items: true } });
    return row ? this.toView(row) : null;
  }

  async create(payload: unknown) {
    const body = asRecord(payload);
    const bizCode = optionalString(body._bizCode);
    const accountId = optionalString(asRecord(body._session).accountId);
    if (!bizCode) rpcFail(400, '缺少业务标识');
    if (!accountId) rpcFail(401, '请使用账户登录后再下单');
    const lines = this.lines(body);
    const headerAmount = Number(body.amount);
    const amount = Number.isFinite(headerAmount) ? Math.round(headerAmount) : lines.reduce((sum, line) => sum + line.amount, 0);
    const id = `o-${randomBytes(8).toString('hex')}`;
    const row = await this.orders.save(
      this.orders.create({
        id,
        bizCode,
        accountId,
        status: this.status(body.status),
        title: optionalString(body.title) ?? null,
        amount,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
    const savedItems = await this.items.save(
      lines.map((line, index) =>
        this.items.create({
          orderId: row.id,
          name: line.name,
          quantity: line.quantity,
          price: line.price,
          amount: line.amount,
          sortOrder: index,
        }),
      ),
    );
    row.items = savedItems;
    return this.toView(row);
  }

  private status(value: unknown): string {
    return typeof value === 'string' && ORDER_STATUSES.has(value) ? value : 'pending';
  }

  private lines(body: Record<string, unknown>): Line[] {
    if (Array.isArray(body.items) && body.items.length) {
      const lines = body.items.map((item) => this.line(item)).filter((item): item is Line => Boolean(item));
      if (!lines.length) rpcFail(400, 'items 不合法');
      return lines;
    }
    const name = optionalString(body.item);
    if (!name) rpcFail(400, 'item 或 items 必填');
    const amount = Math.round(Number(body.amount) || 0);
    return [{ name, quantity: 1, price: amount, amount }];
  }

  private line(value: unknown): Line | null {
    const item = asRecord(value);
    const name = optionalString(item.name) ?? optionalString(item.item);
    if (!name) return null;
    const quantity = Math.max(1, Math.round(Number(item.quantity) || 1));
    const amount = Math.round(Number(item.amount ?? item.price) || 0);
    const price = Number.isFinite(Number(item.price)) ? Math.round(Number(item.price)) : amount;
    return { name: name.slice(0, 200), quantity, price, amount };
  }

  private toView(row: OrderEntity) {
    const items = [...(row.items ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
    return {
      id: row.id,
      accountId: row.accountId,
      status: row.status,
      title: row.title,
      amount: row.amount,
      item: items[0]?.name ?? '',
      items: items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        amount: item.amount,
      })),
      createdAt: row.createdAt.toISOString(),
    };
  }
}
