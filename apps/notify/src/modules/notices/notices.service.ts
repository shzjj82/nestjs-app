import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { rpcFail } from '@app/common';
import type { NotifyMessage } from '@app/notify-contract';
import { Repository } from 'typeorm';
import {
  bizCodeOf,
  requireActor,
  requireUuid,
  toPage,
  unreadOnly,
  type SendCommand,
} from '../../common/input';
import { pushRealtime } from '../../common/push';
import { NoticeEntity } from '../../entities';

@Injectable()
export class NoticesService {
  constructor(
    @InjectRepository(NoticeEntity)
    private readonly notices: Repository<NoticeEntity>,
  ) {}

  async list(payload: Record<string, unknown>) {
    const actor = requireActor(payload);
    const page = toPage(payload.page, payload.pageSize);
    const qb = this.visible(bizCodeOf(payload), actor.userId);
    if (unreadOnly(payload)) {
      qb.andWhere('notice.readAt IS NULL');
    }
    const [rows, total] = await qb
      .orderBy('notice.createdAt', 'DESC')
      .skip(page.skip)
      .take(page.pageSize)
      .getManyAndCount();
    return {
      items: rows.map(toView),
      total,
      page: page.page,
      pageSize: page.pageSize,
    };
  }

  async unreadCount(payload: Record<string, unknown>) {
    const actor = requireActor(payload);
    const count = await this.visible(bizCodeOf(payload), actor.userId)
      .andWhere('notice.readAt IS NULL')
      .getCount();
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
    const result = await this.notices
      .createQueryBuilder()
      .update(NoticeEntity)
      .set({ readAt: new Date() })
      .where('bizCode = :bizCode', { bizCode })
      .andWhere('userId = :userId', { userId: actor.userId })
      .andWhere('readAt IS NULL')
      .andWhere('(expiresAt IS NULL OR expiresAt > NOW())')
      .execute();
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
        expiresAt: command.expiresAt,
      }),
    );
    const view = toView(saved);
    await pushRealtime({ kind: 'notice', action: 'created', item: view });
    return view;
  }

  private visible(bizCode: string, userId: string) {
    return this.notices
      .createQueryBuilder('notice')
      .where('notice.bizCode = :bizCode', { bizCode })
      .andWhere('notice.userId = :userId', { userId })
      .andWhere('(notice.expiresAt IS NULL OR notice.expiresAt > NOW())');
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
    if (row.expiresAt && row.expiresAt.getTime() <= Date.now()) {
      rpcFail(404, '通知已过期');
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
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}
