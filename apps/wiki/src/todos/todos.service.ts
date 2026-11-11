import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  MQTT_PATTERNS,
  NOTIFY_CLIENT,
  WIKI_BIZ_CODE,
  asRecord,
  notifyInternalKey,
  optionalString,
  rpcFail,
  unwrapData,
} from '@app/common';
import { lastValueFrom } from 'rxjs';
import { timeout } from 'rxjs/operators';
import { DocumentsService } from '../documents/documents.service';
import { TeamAccess } from '../documents/team-access';
import {
  asData,
  isPageRef,
  mergeTodoData,
  optionalPageId,
  pageFromTodoData,
  pageRefFromPost,
  requirePageId,
  type WikiTodoPageRef,
} from './page-ref';

/**
 * wiki 自有待办能力：页面关联在 wiki 侧强制完成，再交给 notify 持久化 / 提醒 / 推送。
 * 对外契约是 wiki 产品的，不是对 notify API 的透传。
 */
@Injectable()
export class TodosService implements OnModuleInit {
  constructor(
    private readonly posts: DocumentsService,
    private readonly teams: TeamAccess,
    @Inject(NOTIFY_CLIENT) private readonly notify: ClientProxy,
  ) {}

  async onModuleInit() {
    await this.notify.connect();
  }

  list(payload: Record<string, unknown>) {
    return this.call(MQTT_PATTERNS.TODO_LIST, this.scoped(payload)).then((result) =>
      this.enrichList(result, optionalString(payload.pageId)),
    );
  }

  openCount(payload: Record<string, unknown>) {
    return this.call(MQTT_PATTERNS.TODO_OPEN_COUNT, this.scoped(payload));
  }

  async findOne(payload: Record<string, unknown>) {
    const item = await this.call<Record<string, unknown>>(
      MQTT_PATTERNS.TODO_FIND_ONE,
      this.scoped(payload),
    );
    return this.enrichItem(item);
  }

  async create(payload: Record<string, unknown>) {
    const page = await this.resolveReadablePage(payload, requirePageId(payload.pageId));
    const body = this.scoped({
      ...payload,
      category: optionalString(payload.category) ?? 'page',
      source: 'wiki',
      data: mergeTodoData(payload.data, page),
    });
    return this.enrichItem(
      await this.call<Record<string, unknown>>(MQTT_PATTERNS.TODO_CREATE, body),
    );
  }

  async update(payload: Record<string, unknown>) {
    const pageId = optionalPageId(payload.pageId);
    const current = await this.call<Record<string, unknown>>(
      MQTT_PATTERNS.TODO_FIND_ONE,
      this.scoped(payload),
    );
    const baseData = asData(current.data);
    if (pageId) {
      const page = await this.resolveReadablePage(payload, pageId);
      return this.enrichItem(
        await this.call<Record<string, unknown>>(
          MQTT_PATTERNS.TODO_UPDATE,
          this.scoped({
            ...payload,
            category: optionalString(payload.category) ?? 'page',
            source: 'wiki',
            data: mergeTodoData(payload.data, page, baseData),
          }),
        ),
      );
    }
    const existing = pageFromTodoData(current.data);
    // 历史待办可能没有 page：允许只改标题等内容，但不允许新建无页关联
    const data = existing
      ? mergeTodoData(payload.data, existing, baseData)
      : {
          ...(baseData ?? {}),
          ...(asData(payload.data) ?? {}),
          legacyWithoutPage: true,
        };
    return this.enrichItem(
      await this.call<Record<string, unknown>>(
        MQTT_PATTERNS.TODO_UPDATE,
        this.scoped({
          ...payload,
          category: optionalString(payload.category) ?? (existing ? 'page' : 'system'),
          source: 'wiki',
          data,
        }),
      ),
    );
  }

  /** 给已有待办补绑/改绑文章（含已完成），供历史数据治理 */
  async bindPage(payload: Record<string, unknown>) {
    const page = await this.resolveReadablePage(payload, requirePageId(payload.pageId));
    const current = await this.call<Record<string, unknown>>(
      MQTT_PATTERNS.TODO_FIND_ONE,
      this.scoped(payload),
    );
    const data = mergeTodoData(payload.data, page, asData(current.data));
    delete data.legacyWithoutPage;
    const patched = await this.call<Record<string, unknown>>(
      MQTT_PATTERNS.TODO_PATCH_DATA,
      {
        id: payload.id,
        data,
        _bizCode: WIKI_BIZ_CODE,
        _internal: notifyInternalKey(),
      },
    );
    return this.enrichItem(patched);
  }

  done(payload: Record<string, unknown>) {
    return this.call(MQTT_PATTERNS.TODO_DONE, this.scoped(payload)).then((item) =>
      this.enrichItem(item as Record<string, unknown>),
    );
  }

  cancel(payload: Record<string, unknown>) {
    return this.call(MQTT_PATTERNS.TODO_CANCEL, this.scoped(payload)).then((item) =>
      this.enrichItem(item as Record<string, unknown>),
    );
  }

  private scoped(payload: Record<string, unknown>): Record<string, unknown> {
    return { ...payload, _bizCode: WIKI_BIZ_CODE };
  }

  private async resolveReadablePage(
    payload: Record<string, unknown>,
    pageId: string,
  ): Promise<WikiTodoPageRef> {
    const post = await this.posts.findById(pageId);
    if (!post) {
      rpcFail(404, '关联页面不存在');
    }
    const accountId = optionalString(asRecord(payload._session).accountId);
    if (!accountId) {
      rpcFail(401, '未登录');
    }
    const readable =
      post.visibility === 'public' ||
      post.authorId === accountId ||
      (await this.inTeam(payload, post.appCode, post.teamId, accountId));
    if (!readable) {
      rpcFail(403, '无权关联该页面');
    }
    return pageRefFromPost(post);
  }

  private async inTeam(
    payload: Record<string, unknown>,
    appCode: string,
    teamId: string | null | undefined,
    accountId: string,
  ): Promise<boolean> {
    if (!teamId) {
      return false;
    }
    const items = await this.teams.grants({
      accountId,
      appCode,
      bizCode: optionalString(payload._bizCode) ?? WIKI_BIZ_CODE,
    });
    return items.some((item) => item.teamId === teamId);
  }

  private enrichItem(item: Record<string, unknown> | null | undefined) {
    if (!item || typeof item !== 'object') {
      return item;
    }
    const page = pageFromTodoData(item.data);
    return page ? { ...item, page } : item;
  }

  private enrichList(result: unknown, pageId?: string) {
    if (!result || typeof result !== 'object') {
      return result;
    }
    const record = result as Record<string, unknown>;
    const items = Array.isArray(record.items) ? record.items : null;
    if (!items) {
      return result;
    }
    let mapped = items.map((item) =>
      this.enrichItem(
        item && typeof item === 'object' ? (item as Record<string, unknown>) : null,
      ),
    );
    if (pageId) {
      mapped = mapped.filter((item) => {
        if (!item || typeof item !== 'object') {
          return false;
        }
        const data = asData((item as Record<string, unknown>).data);
        return data?.pageId === pageId || (isPageRef(data?.page) && data.page.id === pageId);
      });
    }
    return {
      ...record,
      items: mapped,
      total: pageId ? mapped.length : record.total,
    };
  }

  private async call<T = unknown>(pattern: string, payload: unknown): Promise<T> {
    try {
      const raw = await lastValueFrom(
        this.notify.send(pattern, payload).pipe(timeout(15_000)),
      );
      return unwrapData<T>(raw);
    } catch (err) {
      const status = rpcStatus(err);
      if (status) {
        rpcFail(status.code, status.message);
      }
      rpcFail(503, '待办服务不可用');
    }
  }
}

function rpcStatus(err: unknown): { code: number; message: string } | null {
  if (typeof err !== 'object' || err === null) {
    return null;
  }
  const record = err as {
    status?: number;
    message?: string;
    error?: { status?: number; message?: string };
  };
  const source = record.error?.status ? record.error : record;
  if (typeof source.status === 'number' && source.message) {
    return { code: source.status, message: String(source.message) };
  }
  return null;
}
