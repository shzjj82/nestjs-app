import { Controller, UseInterceptors } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import {
  ApiDoc,
  DocsHandleLogInterceptor,
  MQTT_GROUPS,
  MQTT_PATTERNS,
  sharePattern,
} from '@app/common';
import { WikiChatService } from './chat.service';

@Controller()
@UseInterceptors(DocsHandleLogInterceptor)
export class WikiChatController {
  constructor(private readonly chat: WikiChatService) {}

  @MessagePattern(sharePattern(MQTT_GROUPS.WIKI, MQTT_PATTERNS.WIKI_AGENTS_CHAT))
  @ApiDoc({ name: 'Wiki 对话', description: '编辑器对话，转发 agents' })
  send(payload: Record<string, unknown>) {
    return this.chat.chat(payload);
  }

  @MessagePattern(sharePattern(MQTT_GROUPS.WIKI, MQTT_PATTERNS.WIKI_AGENTS_CHAT_STATUS))
  status(payload: Record<string, unknown>) {
    return this.chat.status(payload);
  }

  @MessagePattern(sharePattern(MQTT_GROUPS.WIKI, MQTT_PATTERNS.WIKI_AGENTS_CONVERSATION_LIST))
  list(payload: Record<string, unknown>) {
    return this.chat.listConversations(payload);
  }

  @MessagePattern(sharePattern(MQTT_GROUPS.WIKI, MQTT_PATTERNS.WIKI_AGENTS_CONVERSATION_FIND_ONE))
  findOne(payload: Record<string, unknown>) {
    return this.chat.findConversation(payload);
  }

  @MessagePattern(sharePattern(MQTT_GROUPS.WIKI, MQTT_PATTERNS.WIKI_AGENTS_CONVERSATION_UPDATE))
  update(payload: Record<string, unknown>) {
    return this.chat.updateConversation(payload);
  }

  @MessagePattern(sharePattern(MQTT_GROUPS.WIKI, MQTT_PATTERNS.WIKI_AGENTS_CONVERSATION_DELETE))
  remove(payload: Record<string, unknown>) {
    return this.chat.deleteConversation(payload);
  }
}
