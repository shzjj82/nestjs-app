import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { AGENTS_CLIENT, MQTT_PATTERNS } from '@app/common';
import { callDownstream } from '../common/downstream';

/** 编辑器对话页：发消息、看状态、管理会话。 */
@Injectable()
export class WikiChatService implements OnModuleInit {
  constructor(@Inject(AGENTS_CLIENT) private readonly agents: ClientProxy) {}

  async onModuleInit() {
    await this.agents.connect();
  }

  chat(payload: Record<string, unknown>) {
    return this.call(MQTT_PATTERNS.AGENTS_CHAT, payload);
  }

  status(payload: Record<string, unknown>) {
    return this.call(MQTT_PATTERNS.AGENTS_CHAT_STATUS, payload);
  }

  listConversations(payload: Record<string, unknown>) {
    return this.call(MQTT_PATTERNS.AGENTS_CONVERSATION_LIST, payload);
  }

  findConversation(payload: Record<string, unknown>) {
    return this.call(MQTT_PATTERNS.AGENTS_CONVERSATION_FIND_ONE, payload);
  }

  updateConversation(payload: Record<string, unknown>) {
    return this.call(MQTT_PATTERNS.AGENTS_CONVERSATION_UPDATE, payload);
  }

  deleteConversation(payload: Record<string, unknown>) {
    return this.call(MQTT_PATTERNS.AGENTS_CONVERSATION_DELETE, payload);
  }

  private call(pattern: string, payload: Record<string, unknown>) {
    return callDownstream(this.agents, pattern, payload, 90_000, '对话服务不可用');
  }
}
