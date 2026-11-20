import { Injectable } from '@nestjs/common';
import { MQTT_PATTERNS } from '@app/common';
import { PlatformProxy } from '../platform-proxy';

/** 编辑器对话页：发消息、看状态、管理会话。模型调用超时单独放宽。 */
@Injectable()
export class WikiChatService {
  constructor(private readonly platform: PlatformProxy) {}

  chat(payload: Record<string, unknown>) {
    return this.platform.callAgents(MQTT_PATTERNS.AGENTS_CHAT, payload);
  }

  status(payload: Record<string, unknown>) {
    return this.platform.callAgents(MQTT_PATTERNS.AGENTS_CHAT_STATUS, payload);
  }

  listConversations(payload: Record<string, unknown>) {
    return this.platform.callAgents(MQTT_PATTERNS.AGENTS_CONVERSATION_LIST, payload);
  }

  findConversation(payload: Record<string, unknown>) {
    return this.platform.callAgents(MQTT_PATTERNS.AGENTS_CONVERSATION_FIND_ONE, payload);
  }

  updateConversation(payload: Record<string, unknown>) {
    return this.platform.callAgents(MQTT_PATTERNS.AGENTS_CONVERSATION_UPDATE, payload);
  }

  deleteConversation(payload: Record<string, unknown>) {
    return this.platform.callAgents(MQTT_PATTERNS.AGENTS_CONVERSATION_DELETE, payload);
  }
}
