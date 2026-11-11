import { Inject, Injectable, Module, OnModuleInit } from '@nestjs/common';
import { ClientProxy, ClientsModule } from '@nestjs/microservices';
import { lastValueFrom, TimeoutError } from 'rxjs';
import { timeout } from 'rxjs/operators';
import {
  MQTT_PATTERNS,
  NOTIFY_CLIENT,
  mqttClientOptions,
  notifyInternalKey,
  rpcFail,
  unwrapData,
} from '@app/common';

export interface NotifyMessage {
  id: string;
  bizCode: string;
  userId: string;
  title: string;
  content: string;
  category: string;
  source: string;
  data: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
}

/** 四态；兼容读出旧值 `open` 时应归一为 `pending` */
export type NotifyTodoStatus =
  | 'pending'
  | 'in_progress'
  | 'done'
  | 'cancelled'
  | 'open';

export type NotifyTodoNoticeKind =
  | 'todo.started'
  | 'todo.progress'
  | 'todo.overdue';

export interface NotifyTodo {
  id: string;
  bizCode: string;
  userId: string;
  title: string;
  content: string;
  category: string;
  source: string;
  status: NotifyTodoStatus;
  data: Record<string, unknown> | null;
  /** YYYY-MM-DD */
  startsAt: string | null;
  dueAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  cancelledAt: string | null;
  startedNoticeAt: string | null;
  /** YYYY-MM-DD */
  lastProgressNoticeOn: string | null;
  /** YYYY-MM-DD */
  lastOverdueNoticeOn: string | null;
  createdAt: string;
  updatedAt: string;
}

export type NotifyRealtimeEvent =
  | { kind: 'notice'; action: 'created' | 'updated'; item: NotifyMessage }
  | {
      kind: 'notice';
      action: 'read-all';
      item: { bizCode: string; userId: string; updated: number };
    }
  | { kind: 'todo'; action: 'created' | 'updated'; item: NotifyTodo };

export interface NotifySendInput {
  bizCode: string;
  userId: string;
  title: string;
  content: string;
  category?: string;
  source?: string;
  data?: Record<string, unknown> | null;
}

export interface NotifyTodoInput extends NotifySendInput {
  dueAt?: string | null;
  startsAt?: string | null;
  status?: NotifyTodoStatus;
}

/** 通过 MQTT 调通知服务，各业务服务共用 */
@Injectable()
export class NotifyClient implements OnModuleInit {
  constructor(@Inject(NOTIFY_CLIENT) private readonly notify: ClientProxy) {}

  async onModuleInit() {
    await this.notify.connect();
  }

  send(input: NotifySendInput): Promise<NotifyMessage> {
    return this.request(MQTT_PATTERNS.NOTIFY_SEND, input, '发送通知失败');
  }

  createTodo(input: NotifyTodoInput): Promise<NotifyTodo> {
    return this.request(MQTT_PATTERNS.TODO_SEND, input, '创建待办失败');
  }

  private async request<T extends { id: string }>(
    pattern: string,
    input: NotifySendInput | NotifyTodoInput,
    fallback: string,
  ): Promise<T> {
    try {
      const raw = await lastValueFrom(
        this.notify
          .send(pattern, {
            ...input,
            _internal: notifyInternalKey(),
          })
          .pipe(timeout(8000)),
      );
      const message = unwrapData<T>(raw);
      if (!message?.id) {
        rpcFail(502, '通知服务未返回结果');
      }
      return message;
    } catch (err) {
      if (err instanceof TimeoutError) {
        rpcFail(504, '通知服务超时');
      }
      const payload = err as { status?: number; message?: string };
      rpcFail(payload?.status ?? 502, payload?.message ?? fallback);
    }
  }
}

@Module({
  imports: [
    ClientsModule.register([
      {
        name: NOTIFY_CLIENT,
        ...mqttClientOptions('notify-caller'),
      },
    ]),
  ],
  providers: [NotifyClient],
  exports: [NotifyClient],
})
export class NotifyClientModule {}
