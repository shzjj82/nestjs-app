import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  MQTT_PATTERNS,
  NOTIFY_CLIENT,
  WIKI_BIZ_CODE,
  msUntilNextShanghaiMidnight,
  notifyInternalKey,
  unwrapData,
} from '@app/common';
import { lastValueFrom } from 'rxjs';
import { timeout } from 'rxjs/operators';
import {
  deliverWikiReminders,
  type RemindMode,
  type WikiRemindNotice,
  type WikiRemindRow,
  type WikiRemindSlot,
} from './todo-reminder-run';

/**
 * wiki 自有催办定时：上海日零点扫描 started / overdue / progress，
 * 经 notify 仅做存储占坑与投递；文案由客户端按 data.kind 本地化。
 */
@Injectable()
export class TodoReminder
  implements OnModuleInit, OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(TodoReminder.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(@Inject(NOTIFY_CLIENT) private readonly notify: ClientProxy) {}

  async onModuleInit() {
    await this.notify.connect();
  }

  onApplicationBootstrap() {
    void this.remind(new Date(), 'catch-up');
    this.arm();
  }

  onApplicationShutdown() {
    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.timer = null;
  }

  async remind(now: Date, mode: RemindMode): Promise<number> {
    const sent = await deliverWikiReminders(
      {
        list: (slot, remindMode, at) => this.list(slot, remindMode, at),
        claim: (slot, id, today, at) => this.claim(slot, id, today, at),
        release: (slot, id, today) => this.release(slot, id, today),
        send: (notice) => this.send(notice),
        warn: (message) => this.logger.warn(message),
      },
      now,
      mode,
    );
    if (sent > 0) {
      this.logger.log(`已发送 ${sent} 条 wiki 待办催办通知`);
    }
    return sent;
  }

  private arm(): void {
    const wait = msUntilNextShanghaiMidnight(new Date());
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.remind(new Date(), 'midnight')
        .catch((err: unknown) => {
          const message = err instanceof Error ? err.message : 'remind failed';
          this.logger.error(`wiki 待办凌晨催办失败: ${message}`);
        })
        .finally(() => this.arm());
    }, wait);
    this.timer.unref();
  }

  private async list(
    slot: WikiRemindSlot,
    mode: RemindMode,
    now: Date,
  ): Promise<{ items: WikiRemindRow[]; today: string }> {
    const result = await this.call<{ items?: WikiRemindRow[]; today?: string }>(
      MQTT_PATTERNS.TODO_WIKI_REMIND_LIST,
      {
        slot,
        mode,
        now: now.toISOString(),
        _bizCode: WIKI_BIZ_CODE,
        _internal: notifyInternalKey(),
      },
    );
    return {
      items: Array.isArray(result?.items) ? result.items : [],
      today: typeof result?.today === 'string' ? result.today : '',
    };
  }

  private async claim(
    slot: WikiRemindSlot,
    id: string,
    today: string,
    now: Date,
  ): Promise<boolean> {
    const result = await this.call<{ claimed?: boolean }>(
      MQTT_PATTERNS.TODO_WIKI_REMIND_CLAIM,
      {
        slot,
        id,
        today,
        now: now.toISOString(),
        _bizCode: WIKI_BIZ_CODE,
        _internal: notifyInternalKey(),
      },
    );
    return result?.claimed === true;
  }

  private async release(slot: WikiRemindSlot, id: string, today: string) {
    await this.call(MQTT_PATTERNS.TODO_WIKI_REMIND_RELEASE, {
      slot,
      id,
      today,
      _bizCode: WIKI_BIZ_CODE,
      _internal: notifyInternalKey(),
    });
  }

  private send(notice: WikiRemindNotice) {
    return this.call(MQTT_PATTERNS.NOTIFY_SEND, {
      ...notice,
      _internal: notifyInternalKey(),
    });
  }

  private async call<T = unknown>(
    pattern: string,
    payload: Record<string, unknown>,
  ): Promise<T> {
    const raw = await lastValueFrom(
      this.notify.send(pattern, payload).pipe(timeout(15_000)),
    );
    return unwrapData<T>(raw);
  }
}
