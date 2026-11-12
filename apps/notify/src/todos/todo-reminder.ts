import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { NoticesService } from '../notices/notices.service';
import { TodoEntity } from '../entities';
import { msUntilNextShanghaiMidnight } from './shanghai-day';
import { deliverDueTodos, type RemindMode } from './todo-reminder-run';

@Injectable()
export class TodoReminder implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(TodoReminder.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    @InjectRepository(TodoEntity)
    private readonly todos: Repository<TodoEntity>,
    private readonly notices: NoticesService,
  ) {}

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

  /**
   * 每日上海日：wiki 待办 started / progress / overdue 通知；
   * 开始日只发通知，不自动改 status。非 wiki 保留截止日当天提醒。
   */
  async remind(now: Date, mode: RemindMode): Promise<number> {
    const sent = await deliverDueTodos(
      {
        query: (sql, params) => this.todos.query(sql, params),
        send: (command) => this.notices.send(command),
        warn: (message) => this.logger.warn(message),
      },
      now,
      mode,
    );
    if (sent > 0) {
      this.logger.log(`已发送 ${sent} 条待办定时通知`);
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
          this.logger.error(`待办凌晨通知失败: ${message}`);
        })
        .finally(() => this.arm());
    }, wait);
    this.timer.unref();
  }
}
