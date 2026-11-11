import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { rpcFail } from '@app/common';
import type { NotifyTodo } from '@app/notify-contract';
import { In, Repository } from 'typeorm';
import {
  bizCodeOf,
  parseSend,
  parseStatusFilter,
  parseUpdateMine,
  requireActor,
  requireUuid,
  toPage,
  type SendCommand,
} from '../common/input';
import { pushRealtime } from '../common/push';
import { TodoEntity } from '../entities';
import { shanghaiDayOf } from './shanghai-day';
import {
  applyStatusTransition,
  normalizeTodoStatus,
  reopenTargetStatus,
  type CanonicalTodoStatus,
} from './todo-status';

@Injectable()
export class TodosService {
  constructor(
    @InjectRepository(TodoEntity)
    private readonly todos: Repository<TodoEntity>,
  ) {}

  async list(payload: Record<string, unknown>) {
    const actor = requireActor(payload);
    const page = toPage(payload.page, payload.pageSize);
    const statuses = parseStatusFilter(payload.status);
    const qb = this.todos
      .createQueryBuilder('todo')
      .where('todo.biz_code = :bizCode', { bizCode: bizCodeOf(payload) })
      .andWhere('todo.user_id = :userId', { userId: actor.userId })
      .orderBy('todo.created_at', 'DESC')
      .skip(page.skip)
      .take(page.pageSize);
    if (statuses?.length) {
      qb.andWhere('todo.status IN (:...statuses)', {
        statuses: expandStatusQuery(statuses),
      });
    }
    const [rows, total] = await qb.getManyAndCount();
    return {
      items: rows.map(toView),
      total,
      page: page.page,
      pageSize: page.pageSize,
    };
  }

  async openCount(payload: Record<string, unknown>) {
    const actor = requireActor(payload);
    const count = await this.todos.count({
      where: {
        bizCode: bizCodeOf(payload),
        userId: actor.userId,
        status: In(['pending', 'in_progress', 'open']),
      },
    });
    return { count };
  }

  async findOne(payload: Record<string, unknown>) {
    return toView(await this.own(payload));
  }

  async createMine(payload: Record<string, unknown>) {
    const actor = requireActor(payload);
    const { source: _source, userId: _userId, bizCode: _bizCode, ...rest } = payload;
    const command = parseSend(
      { ...rest, bizCode: bizCodeOf(payload), userId: actor.userId },
      'user',
    );
    return this.create(command);
  }

  async updateMine(payload: Record<string, unknown>) {
    const row = await this.own(payload);
    const command = parseUpdateMine(payload);
    row.title = command.title;
    if (command.content !== undefined) {
      row.content = command.content;
    }
    row.category = command.category;
    row.data = command.data;
    if (command.startsAt !== undefined) {
      row.startsAt = command.startsAt;
    } else if (command.data && typeof command.data.start === 'string') {
      const start = command.data.start.trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(start)) {
        row.startsAt = start;
      }
    }
    if (shanghaiDayOf(row.dueAt) !== shanghaiDayOf(command.dueAt)) {
      row.remindedOn = null;
    }
    row.dueAt = command.dueAt;
    if (command.status) {
      this.applyTransition(row, command.status);
    }
    await this.todos.save(row);
    const view = toView(row);
    await pushRealtime({ kind: 'todo', action: 'updated', item: view });
    return view;
  }

  async create(command: SendCommand): Promise<NotifyTodo> {
    const now = new Date();
    const status = command.status;
    const saved = await this.todos.save(
      this.todos.create({
        bizCode: command.bizCode,
        userId: command.userId,
        title: command.title,
        content: command.content,
        category: command.category,
        source: command.source,
        status,
        data: command.data,
        startsAt: command.startsAt,
        dueAt: command.dueAt,
        startedAt: status === 'in_progress' ? now : null,
        remindedOn: null,
        finishedAt: status === 'done' ? now : null,
        cancelledAt: status === 'cancelled' ? now : null,
        startedNoticeAt: null,
        lastProgressNoticeOn: null,
        lastOverdueNoticeOn: null,
      }),
    );
    const view = toView(saved);
    await pushRealtime({ kind: 'todo', action: 'created', item: view });
    return view;
  }

  async start(payload: Record<string, unknown>) {
    const row = await this.own(payload);
    this.applyTransition(row, 'in_progress');
    await this.todos.save(row);
    const view = toView(row);
    await pushRealtime({ kind: 'todo', action: 'updated', item: view });
    return view;
  }

  async finish(payload: Record<string, unknown>, action: 'done' | 'cancel') {
    const row = await this.own(payload);
    this.applyTransition(row, action === 'done' ? 'done' : 'cancelled');
    await this.todos.save(row);
    const view = toView(row);
    await pushRealtime({ kind: 'todo', action: 'updated', item: view });
    return view;
  }

  async reopen(payload: Record<string, unknown>) {
    const row = await this.own(payload);
    const current = normalizeTodoStatus(row.status);
    if (current !== 'done' && current !== 'cancelled') {
      rpcFail(400, '仅已完成或已终止的待办可重新打开');
    }
    this.applyTransition(row, reopenTargetStatus(row.startsAt));
    await this.todos.save(row);
    const view = toView(row);
    await pushRealtime({ kind: 'todo', action: 'updated', item: view });
    return view;
  }

  /** 内部：任意状态待办只补丁 data（wiki 给历史待办绑页面） */
  async patchData(payload: Record<string, unknown>) {
    const id = requireUuid(payload.id, 'id');
    const bizCode = bizCodeOf(payload);
    const row = await this.todos.findOne({ where: { id, bizCode } });
    if (!row) {
      rpcFail(404, '待办不存在');
    }
    const data = payload.data;
    if (data !== null && (typeof data !== 'object' || Array.isArray(data))) {
      rpcFail(400, 'data 必须是对象');
    }
    row.data = (data as Record<string, unknown> | null) ?? null;
    await this.todos.save(row);
    const view = toView(row);
    await pushRealtime({ kind: 'todo', action: 'updated', item: view });
    return view;
  }

  private applyTransition(row: TodoEntity, next: CanonicalTodoStatus) {
    const result = applyStatusTransition({
      current: row.status,
      next,
      startsAt: row.startsAt,
    });
    row.status = result.status;
    if (result.startedAt) {
      row.startedAt = row.startedAt ?? result.startedAt;
    }
    if (result.finishedAt !== undefined) {
      row.finishedAt = result.finishedAt;
    }
    if (result.cancelledAt !== undefined) {
      row.cancelledAt = result.cancelledAt;
    }
    if (result.clearFinished) {
      row.finishedAt = null;
    }
    if (result.clearCancelled) {
      row.cancelledAt = null;
    }
  }

  private async own(payload: Record<string, unknown>): Promise<TodoEntity> {
    const actor = requireActor(payload);
    const id = requireUuid(payload.id, 'id');
    const row = await this.todos.findOne({
      where: { id, bizCode: bizCodeOf(payload), userId: actor.userId },
    });
    if (!row) {
      rpcFail(404, '待办不存在');
    }
    return row;
  }
}

function expandStatusQuery(statuses: CanonicalTodoStatus[]): string[] {
  const set = new Set<string>(statuses);
  if (set.has('pending')) {
    set.add('open');
  }
  return [...set];
}

function toView(row: TodoEntity): NotifyTodo {
  return {
    id: row.id,
    bizCode: row.bizCode,
    userId: row.userId,
    title: row.title,
    content: row.content,
    category: row.category,
    source: row.source,
    status: normalizeTodoStatus(row.status),
    data: row.data,
    startsAt: row.startsAt,
    dueAt: row.dueAt ? row.dueAt.toISOString() : null,
    startedAt: row.startedAt ? row.startedAt.toISOString() : null,
    finishedAt: row.finishedAt ? row.finishedAt.toISOString() : null,
    cancelledAt: row.cancelledAt ? row.cancelledAt.toISOString() : null,
    startedNoticeAt: row.startedNoticeAt ? row.startedNoticeAt.toISOString() : null,
    lastProgressNoticeOn: row.lastProgressNoticeOn,
    lastOverdueNoticeOn: row.lastOverdueNoticeOn,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
