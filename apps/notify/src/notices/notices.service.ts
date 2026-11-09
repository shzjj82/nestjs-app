import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { rpcFail } from '@app/common';
import type { NotifyMessage } from '@app/notify-contract';
import { FindOptionsWhere, IsNull, Repository } from 'typeorm';
import {
  bizCodeOf,
  requireActor,
  requireUuid,
  toPage,
  unreadOnly,
  type SendCommand,
} from '../common/input';
import { pushRealtime } from '../common/push';
import { NoticeEntity } from '../entities';

@Injectable()
export class NoticesService {
  constructor(
    @InjectRepository(NoticeEntity)
    private readonly notices: Repository<NoticeEntity>,
  ) {}

  async list(payload: Record<string, unknown>) {
    const actor = requireActor(payload);
    const page = toPage(payload.page, payload.pageSize);
    const where: FindOptionsWhere<NoticeEntity> = {
      bizCode: bizCodeOf(payload),
      userId: actor.userId,
    };
    if (unreadOnly(payload)) {
      where.readAt = IsNull();
    }
    const [rows, total] = await this.notices.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: page.skip,
      take: page.pageSize,
    });
    return {
      items: rows.map(toView),
      total,
      page: page.page,
      pageSize: page.pageSize,
    };
  }

  async unreadCount(payload: Record<string, unknown>) {
    const actor = requireActor(payload);
    const count = await this.notices.count({
      where: {
        bizCode: bizCodeOf(payload),
        userId: actor.userId,
        readAt: IsNull(),
      },
    });
    return { count };
  }

  async findOne(payload: Record<string, unknown>) {
    return toView(await this.own(payload));
  }

  async markRead(payload: Record<string, unknown>) {
    const row = await this.own(payload);
    if (!row.readAt) {
      row.readAt = new Date();
      await this.notices.save(row);
      const view = toView(row);
      await pushRealtime({ kind: 'notice', action: 'updated', item: view });
      return view;
    }
    return toView(row);
  }

  async markAllRead(payload: Record<string, unknown>) {
    const actor = requireActor(payload);
    const bizCode = bizCodeOf(payload);
    const result = await this.notices.update(
      { bizCode, userId: actor.userId, readAt: IsNull() },
      { readAt: new Date() },
    );
    await pushRealtime({
      kind: 'notice',
      action: 'read-all',
      item: { bizCode, userId: actor.userId, updated: result.affected ?? 0 },
    });
    return { updated: result.affected ?? 0 };
  }

  async send(command: SendCommand): Promise<NotifyMessage> {
    const saved = await this.notices.save(
      this.notices.create({
        bizCode: command.bizCode,
        userId: command.userId,
        title: command.title,
        content: command.content,
        category: command.category,
        source: command.source,
        data: command.data,
        readAt: null,
      }),
    );
    const view = toView(saved);
    await pushRealtime({ kind: 'notice', action: 'created', item: view });
    return view;
  }

  private async own(payload: Record<string, unknown>): Promise<NoticeEntity> {
    const actor = requireActor(payload);
    const id = requireUuid(payload.id, 'id');
    const row = await this.notices.findOne({
      where: { id, bizCode: bizCodeOf(payload), userId: actor.userId },
    });
    if (!row) {
      rpcFail(404, '通知不存在');
    }
    return row;
  }
}

function toView(row: NoticeEntity): NotifyMessage {
  return {
    id: row.id,
    bizCode: row.bizCode,
    userId: row.userId,
    title: row.title,
    content: row.content,
    category: row.category,
    source: row.source,
    data: row.data,
    readAt: row.readAt ? row.readAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}
