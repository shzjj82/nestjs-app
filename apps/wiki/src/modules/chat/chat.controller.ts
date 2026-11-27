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

  @MessagePattern(sharePattern(MQTT_GROUPS.WIKI, MQTT_PATTERNS.WIKI_AGENTS_CHAT_PREPARE))
  @ApiDoc({ name: 'Wiki 对话准备', description: '原样返回问题，检索由 agents 完成' })
  prepare(payload: Record<string, unknown>) {
    return this.chat.prepare(payload);
  }

  @MessagePattern(sharePattern(MQTT_GROUPS.WIKI, MQTT_PATTERNS.WIKI_AGENTS_CHAT_STATUS))
  status(payload: Record<string, unknown>) {
    return this.chat.status(payload);
  }
}
