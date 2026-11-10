import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { rpcFail } from '@app/common';
import type { NotifyTodo } from '@app/notify-contract';
import { FindOptionsWhere, Repository } from 'typeorm';
import {
  bizCodeOf,
  finishTodo,
  parseSend,
  parseUpdateMine,
  requireActor,
  requireUuid,
  todoStatusOf,
  toPage,
  type SendCommand,
} from '../common/input';
import { pushRealtime } from '../common/push';
import { TodoEntity } from '../entities';
import { shanghaiDayOf } from './shanghai-day';

@Injectable()
export class TodosService {
  constructor(
    @InjectRepository(TodoEntity)
    private readonly todos: Repository<TodoEntity>,
  ) {}

  async list(payload: Record<string, unknown>) {
    const actor = requireActor(payload);
    const page = toPage(payload.page, payload.pageSize);
    const where: FindOptionsWhere<TodoEntity> = {
      bizCode: bizCodeOf(payload),
      userId: actor.userId,
    };
    const status = todoStatusOf(payload);
    if (status) {
      where.status = status;
    }
    const [rows, total] = await this.todos.findAndCount({
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

  async openCount(payload: Record<string, unknown>) {
    const actor = requireActor(payload);
    const count = await this.todos.count({
      where: {
        bizCode: bizCodeOf(payload),
        userId: actor.userId,
        status: 'open',
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
    if (row.status !== 'open') {
      rpcFail(409, '待办已结束');
    }
    const command = parseUpdateMine(payload);
    row.title = command.title;
    row.content = command.content;
    row.category = command.category;
    row.data = command.data;
    if (shanghaiDayOf(row.dueAt) !== shanghaiDayOf(command.dueAt)) {
      row.remindedOn = null;
    }
    row.dueAt = command.dueAt;
    await this.todos.save(row);
    const view = toView(row);
    await pushRealtime({ kind: 'todo', action: 'updated', item: view });
    return view;
  }

  async create(command: SendCommand): Promise<NotifyTodo> {
    const saved = await this.todos.save(
      this.todos.create({
        bizCode: command.bizCode,
        userId: command.userId,
        title: command.title,
        content: command.content,
        category: command.category,
        source: command.source,
        status: 'open',
        data: command.data,
        dueAt: command.dueAt,
        remindedOn: null,
        finishedAt: null,
      }),
    );
    const view = toView(saved);
    await pushRealtime({ kind: 'todo', action: 'created', item: view });
    return view;
  }

  async finish(payload: Record<string, unknown>, action: 'done' | 'cancel') {
    const row = await this.own(payload);
    row.status = finishTodo(row.status, action);
    row.finishedAt = new Date();
    await this.todos.save(row);
    const view = toView(row);
    await pushRealtime({ kind: 'todo', action: 'updated', item: view });
    return view;
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

function toView(row: TodoEntity): NotifyTodo {
  return {
    id: row.id,
    bizCode: row.bizCode,
    userId: row.userId,
    title: row.title,
    content: row.content,
    category: row.category,
    source: row.source,
    status: row.status,
    data: row.data,
    dueAt: row.dueAt ? row.dueAt.toISOString() : null,
    finishedAt: row.finishedAt ? row.finishedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
