import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  MQTT_PATTERNS,
  NOTIFY_CLIENT,
  WIKI_BIZ_CODE,
  notifyInternalKey,
} from '@app/common';

/** 文档删除后异步清掉挂在这些 pageId 上的 wiki 待办，不阻塞删除主路径 */
@Injectable()
export class TodoPageCleanup implements OnModuleInit {
  private readonly logger = new Logger(TodoPageCleanup.name);

  constructor(@Inject(NOTIFY_CLIENT) private readonly notify: ClientProxy) {}

  async onModuleInit() {
    await this.notify.connect();
  }

  removeByPages(pageIds: string[]) {
    const cleaned = [...new Set(pageIds.map((id) => id.trim()).filter(Boolean))];
    if (!cleaned.length) {
      return;
    }
    this.notify
      .send(MQTT_PATTERNS.TODO_DELETE_BY_PAGES, {
        pageIds: cleaned,
        _bizCode: WIKI_BIZ_CODE,
        _internal: notifyInternalKey(),
      })
      .subscribe({
        next: (result: unknown) => {
          const payload =
            result &&
            typeof result === 'object' &&
            'data' in result &&
            'service' in result
              ? (result as { data: unknown }).data
              : result;
          const deleted =
            payload && typeof payload === 'object' && 'deleted' in payload
              ? Number((payload as { deleted: unknown }).deleted)
              : undefined;
          if (deleted && deleted > 0) {
            this.logger.log(`已级联删除 ${deleted} 条页面待办`);
          }
        },
        error: (err: unknown) => {
          this.logger.warn(
            `页面待办级联删除失败: ${err instanceof Error ? err.message : String(err)}`,
          );
        },
      });
  }
}
