import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { MQTT_PATTERNS, NOTIFY_CLIENT } from '@app/common';
import { callDownstream } from '../common/downstream';

/** 编辑器通知收件箱。待办不走这里。 */
@Injectable()
export class WikiInboxService implements OnModuleInit {
  constructor(@Inject(NOTIFY_CLIENT) private readonly notify: ClientProxy) {}

  async onModuleInit() {
    await this.notify.connect();
  }

  list(payload: Record<string, unknown>) {
    return this.call(MQTT_PATTERNS.NOTIFY_LIST, payload);
  }

  unreadCount(payload: Record<string, unknown>) {
    return this.call(MQTT_PATTERNS.NOTIFY_UNREAD_COUNT, payload);
  }

  findOne(payload: Record<string, unknown>) {
    return this.call(MQTT_PATTERNS.NOTIFY_FIND_ONE, payload);
  }

  markRead(payload: Record<string, unknown>) {
    return this.call(MQTT_PATTERNS.NOTIFY_READ, payload);
  }

  markAllRead(payload: Record<string, unknown>) {
    return this.call(MQTT_PATTERNS.NOTIFY_READ_ALL, payload);
  }

  private call(pattern: string, payload: Record<string, unknown>) {
    return callDownstream(this.notify, pattern, payload, 15_000, '通知服务不可用');
  }
}
