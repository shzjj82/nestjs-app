import { Controller, UseInterceptors } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { DocsHandleLogInterceptor, MQTT_GROUPS, MQTT_PATTERNS, sharePattern } from '@app/common';
import { WikiInboxService } from './inbox.service';

@Controller()
@UseInterceptors(DocsHandleLogInterceptor)
export class WikiInboxController {
  constructor(private readonly inbox: WikiInboxService) {}

  @MessagePattern(sharePattern(MQTT_GROUPS.WIKI, MQTT_PATTERNS.WIKI_NOTIFY_LIST))
  list(payload: Record<string, unknown>) {
    return this.inbox.list(payload);
  }

  @MessagePattern(sharePattern(MQTT_GROUPS.WIKI, MQTT_PATTERNS.WIKI_NOTIFY_UNREAD_COUNT))
  unreadCount(payload: Record<string, unknown>) {
    return this.inbox.unreadCount(payload);
  }

  @MessagePattern(sharePattern(MQTT_GROUPS.WIKI, MQTT_PATTERNS.WIKI_NOTIFY_FIND_ONE))
  findOne(payload: Record<string, unknown>) {
    return this.inbox.findOne(payload);
  }

  @MessagePattern(sharePattern(MQTT_GROUPS.WIKI, MQTT_PATTERNS.WIKI_NOTIFY_READ))
  markRead(payload: Record<string, unknown>) {
    return this.inbox.markRead(payload);
  }

  @MessagePattern(sharePattern(MQTT_GROUPS.WIKI, MQTT_PATTERNS.WIKI_NOTIFY_READ_ALL))
  markAllRead(payload: Record<string, unknown>) {
    return this.inbox.markAllRead(payload);
  }
}
