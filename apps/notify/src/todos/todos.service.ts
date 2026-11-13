import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { rpcFail } from '@app/common';
import type { NotifyTodo } from '@app/notify-contract';
import { Repository } from 'typeorm';
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
import { shanghaiDate, shanghaiDayOf } from './shanghai-day';
import { asPageIds } from './todo-page-ids';
import {
  applyStatusTransition,
  normalizeTodoStatus,
  reopenTargetStatus,
  type CanonicalTodoStatus,
} from './todo-status';
import {
  isWikiRemindSlot,
  wikiRemindClaimParams,
  wikiRemindClaimSql,
  wikiRemindListParams,
  wikiRemindListSql,
  wikiRemindReleaseParams,
  wikiRemindReleaseSql,
  type RemindMode,
  type WikiRemindRow,
} from './wiki-remind-store';

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
      // 列表壳 kind=list 不是任务；铃铛/待办栏只看 task（或缺省旧数据）
      .andWhere(`(todo.data->>'kind' IS NULL OR todo.data->>'kind' <> 'list')`)
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
    const count = await this.todos
      .createQueryBuilder('todo')
      .where('todo.biz_code = :bizCode', { bizCode: bizCodeOf(payload) })
      .andWhere('todo.user_id = :userId', { userId: actor.userId })
      .andWhere('todo.status IN (:...statuses)', {
        statuses: ['pending', 'in_progress', 'open'],
      })
      .andWhere(`(todo.data->>'kind' IS NULL OR todo.data->>'kind' <> 'list')`)
      .getCount();
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

  /** 内部：wiki 催办扫描候选行（存储查询；何时/何种 kind 由 wiki 决定） */
  async wikiRemindList(payload: Record<string, unknown>) {
    const slot = payload.slot;
    if (!isWikiRemindSlot(slot)) {
      rpcFail(400, 'slot 须为 todo.started / todo.progress / todo.overdue');
    }
    const mode = payload.mode === 'catch-up' ? 'catch-up' : 'midnight';
    const now = parseNow(payload.now);
    const today = shanghaiDate(now);
    const rows = (await this.todos.query(
      wikiRemindListSql(slot, mode as RemindMode),
      wikiRemindListParams(today, now, mode as RemindMode),
    )) as WikiRemindRow[];
    return { items: Array.isArray(rows) ? rows : [], today };
  }

  /** 内部：wiki 催办占坑 */
  async wikiRemindClaim(payload: Record<string, unknown>) {
    const slot = payload.slot;
    if (!isWikiRemindSlot(slot)) {
      rpcFail(400, 'slot 须为 todo.started / todo.progress / todo.overdue');
    }
    const id = requireUuid(payload.id, 'id');
    const now = parseNow(payload.now);
    const today =
      typeof payload.today === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(payload.today)
        ? payload.today
        : shanghaiDate(now);
    const claimed = await this.todos.query(
      wikiRemindClaimSql(slot),
      wikiRemindClaimParams(slot, id, today, now),
    );
    return {
      claimed: Array.isArray(claimed) && claimed.length > 0,
      id,
      today,
    };
  }

  /** 内部：wiki 催办发送失败后释放占坑 */
  async wikiRemindRelease(payload: Record<string, unknown>) {
    const slot = payload.slot;
    if (!isWikiRemindSlot(slot)) {
      rpcFail(400, 'slot 须为 todo.started / todo.progress / todo.overdue');
    }
    const id = requireUuid(payload.id, 'id');
    const today =
      typeof payload.today === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(payload.today)
        ? payload.today
        : shanghaiDate(parseNow(payload.now));
    await this.todos.query(
      wikiRemindReleaseSql(slot),
      wikiRemindReleaseParams(slot, id, today),
    );
    return { released: true, id };
  }

  /** 内部：文档删除时按 pageId 物理删除 wiki 待办 */
  async deleteByPages(payload: Record<string, unknown>) {
    const bizCode = bizCodeOf(payload);
    const pageIds = asPageIds(payload.pageIds ?? payload.pageId);
    if (!pageIds.length) {
      rpcFail(400, 'pageIds 必填');
    }
    const rows = (await this.todos.query(
      `
        DELETE FROM nt_todos
        WHERE biz_code = $1
          AND source = 'wiki'
          AND (
            data->>'pageId' = ANY($2::text[])
            OR COALESCE(data->'page'->>'id', '') = ANY($2::text[])
          )
        RETURNING id, biz_code AS "bizCode", user_id AS "userId"
      `,
      [bizCode, pageIds],
    )) as Array<{ id: string; bizCode: string; userId: string }>;
    for (const row of rows) {
      await pushRealtime({
        kind: 'todo',
        action: 'deleted',
        item: { id: row.id, bizCode: row.bizCode, userId: row.userId },
      });
    }
    return { deleted: rows.length, ids: rows.map((row) => row.id) };
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

function parseNow(raw: unknown): Date {
  if (typeof raw === 'string' || typeof raw === 'number') {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return raw;
  }
  return new Date();
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
