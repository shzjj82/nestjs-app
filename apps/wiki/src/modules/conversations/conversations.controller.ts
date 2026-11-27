import { Controller, UseInterceptors } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import {
  ApiDoc,
  DocsHandleLogInterceptor,
  MQTT_GROUPS,
  MQTT_PATTERNS,
  sharePattern,
} from '@app/common';
import { WikiConversationsService } from './conversations.service';

@Controller()
@UseInterceptors(DocsHandleLogInterceptor)
export class WikiConversationsController {
  constructor(private readonly conversations: WikiConversationsService) {}

  @MessagePattern(sharePattern(MQTT_GROUPS.WIKI, MQTT_PATTERNS.WIKI_AGENTS_CONVERSATION_LIST))
  list(payload: Record<string, unknown>) {
    return this.conversations.list(payload);
  }

  @MessagePattern(sharePattern(MQTT_GROUPS.WIKI, MQTT_PATTERNS.WIKI_AGENTS_CONVERSATION_FIND_ONE))
  findOne(payload: Record<string, unknown>) {
    return this.conversations.findOne(payload);
  }

  @MessagePattern(sharePattern(MQTT_GROUPS.WIKI, MQTT_PATTERNS.WIKI_AGENTS_CONVERSATION_UPDATE))
  update(payload: Record<string, unknown>) {
    return this.conversations.update(payload);
  }

  @MessagePattern(sharePattern(MQTT_GROUPS.WIKI, MQTT_PATTERNS.WIKI_AGENTS_CONVERSATION_DELETE))
  remove(payload: Record<string, unknown>) {
    return this.conversations.remove(payload);
  }
}
