import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { AGENTS_CLIENT, MQTT_PATTERNS, markWikiCitations } from '@app/common';
import { callDownstream } from '../common/downstream';

/** 编辑器里的会话列表、详情和改名删除。 */
@Injectable()
export class WikiConversationsService implements OnModuleInit {
  constructor(@Inject(AGENTS_CLIENT) private readonly agents: ClientProxy) {}

  async onModuleInit() {
    await this.agents.connect();
  }

  list(payload: Record<string, unknown>) {
    return this.call(MQTT_PATTERNS.AGENTS_CONVERSATION_LIST, payload);
  }

  async findOne(payload: Record<string, unknown>) {
    const detail = await this.call<Record<string, unknown>>(
      MQTT_PATTERNS.AGENTS_CONVERSATION_FIND_ONE,
      payload,
    );
    return markConversation(detail);
  }

  update(payload: Record<string, unknown>) {
    return this.call(MQTT_PATTERNS.AGENTS_CONVERSATION_UPDATE, payload);
  }

  remove(payload: Record<string, unknown>) {
    return this.call(MQTT_PATTERNS.AGENTS_CONVERSATION_DELETE, payload);
  }

  private call<T>(pattern: string, payload: Record<string, unknown>) {
    return callDownstream<T>(this.agents, pattern, payload, 90_000, '对话服务不可用');
  }
}

function markConversation(detail: Record<string, unknown>) {
  if (!Array.isArray(detail.messages)) {
    return detail;
  }
  return {
    ...detail,
    messages: detail.messages.map((item) => markMessage(item)),
  };
}

function markMessage(item: unknown) {
  if (!item || typeof item !== 'object') {
    return item;
  }
  const row = item as Record<string, unknown>;
  if (row.role !== 'assistant' || typeof row.content !== 'string') {
    return item;
  }
  return { ...row, content: markWikiCitations(row.content, row.sources) };
}
