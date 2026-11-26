import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { AGENTS_CLIENT, MQTT_PATTERNS } from '@app/common';
import { callDownstream } from '../common/downstream';
import { TodosService } from '../todos/todos.service';
import { markWikiCitations } from './inline-cite';
import { asksAboutTodos, formatTodoContext, lastUserText, todoStatusQuery, withTodoContext } from './todo-context';

/** 编辑器对话页：发消息、看状态、管理会话。 */
@Injectable()
export class WikiChatService implements OnModuleInit {
  private readonly logger = new Logger('WikiChat');

  constructor(
    @Inject(AGENTS_CLIENT) private readonly agents: ClientProxy,
    private readonly todos: TodosService,
  ) {}

  async onModuleInit() {
    await this.agents.connect();
  }

  async chat(payload: Record<string, unknown>) {
    const prepared = await this.prepare(payload);
    const result = await this.call<Record<string, unknown>>(MQTT_PATTERNS.AGENTS_CHAT, prepared);
    return markChatReply(result);
  }

  /** 问待办时附上本人待办清单。流式入口在转给 agents 之前也会走这里。 */
  async prepare(payload: Record<string, unknown>) {
    const text = lastUserText(payload);
    if (!asksAboutTodos(text)) {
      return payload;
    }
    try {
      const status = todoStatusQuery(text);
      const listed = await this.todos.list({
        ...payload,
        page: 1,
        pageSize: 100,
        ...(status ? { status } : {}),
      });
      const items =
        listed && typeof listed === 'object' && Array.isArray((listed as { items?: unknown }).items)
          ? (listed as { items: unknown[] }).items
          : [];
      return withTodoContext(payload, formatTodoContext(items));
    } catch (err) {
      this.logger.warn(`待办清单不可用: ${err instanceof Error ? err.message : String(err)}`);
      return payload;
    }
  }

  status(payload: Record<string, unknown>) {
    return this.call(MQTT_PATTERNS.AGENTS_CHAT_STATUS, payload);
  }

  listConversations(payload: Record<string, unknown>) {
    return this.call(MQTT_PATTERNS.AGENTS_CONVERSATION_LIST, payload);
  }

  async findConversation(payload: Record<string, unknown>) {
    const detail = await this.call<Record<string, unknown>>(
      MQTT_PATTERNS.AGENTS_CONVERSATION_FIND_ONE,
      payload,
    );
    return markConversation(detail);
  }

  updateConversation(payload: Record<string, unknown>) {
    return this.call(MQTT_PATTERNS.AGENTS_CONVERSATION_UPDATE, payload);
  }

  deleteConversation(payload: Record<string, unknown>) {
    return this.call(MQTT_PATTERNS.AGENTS_CONVERSATION_DELETE, payload);
  }

  private call<T>(pattern: string, payload: Record<string, unknown>) {
    return callDownstream<T>(this.agents, pattern, payload, 90_000, '对话服务不可用');
  }
}

function markChatReply(result: Record<string, unknown>) {
  if (typeof result.reply !== 'string') {
    return result;
  }
  return { ...result, reply: markWikiCitations(result.reply, result.sources) };
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
