import { Injectable } from '@nestjs/common';
import { MQTT_PATTERNS } from '@app/common';
import { PlatformProxy } from '../platform-proxy';

/** 编辑器通知收件箱：列表、未读、已读。待办不走这里。 */
@Injectable()
export class WikiInboxService {
  constructor(private readonly platform: PlatformProxy) {}

  list(payload: Record<string, unknown>) {
    return this.platform.callNotify(MQTT_PATTERNS.NOTIFY_LIST, payload);
  }

  unreadCount(payload: Record<string, unknown>) {
    return this.platform.callNotify(MQTT_PATTERNS.NOTIFY_UNREAD_COUNT, payload);
  }

  findOne(payload: Record<string, unknown>) {
    return this.platform.callNotify(MQTT_PATTERNS.NOTIFY_FIND_ONE, payload);
  }

  markRead(payload: Record<string, unknown>) {
    return this.platform.callNotify(MQTT_PATTERNS.NOTIFY_READ, payload);
  }

  markAllRead(payload: Record<string, unknown>) {
    return this.platform.callNotify(MQTT_PATTERNS.NOTIFY_READ_ALL, payload);
  }
}
