import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { AGENTS_CLIENT, MQTT_PATTERNS, markWikiCitations } from '@app/common';
import { callDownstream } from '../common/downstream';

/** 编辑器对话：发消息、看模型是否就绪。 */
@Injectable()
export class WikiChatService implements OnModuleInit {
  constructor(@Inject(AGENTS_CLIENT) private readonly agents: ClientProxy) {}

  async onModuleInit() {
    await this.agents.connect();
  }

  async chat(payload: Record<string, unknown>) {
    const result = await this.call<Record<string, unknown>>(MQTT_PATTERNS.AGENTS_CHAT, payload);
    return markChatReply(result);
  }

  /** 保留入口。问题原样交给检索，不再按关键字改写。 */
  prepare(payload: Record<string, unknown>) {
    return payload;
  }

  status(payload: Record<string, unknown>) {
    return this.call(MQTT_PATTERNS.AGENTS_CHAT_STATUS, payload);
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
