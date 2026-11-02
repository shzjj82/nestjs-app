import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { lastValueFrom, TimeoutError } from 'rxjs';
import { timeout } from 'rxjs/operators';
import { unwrapData } from './http';
import { AGENTS_CLIENT, MQTT_PATTERNS } from './patterns';
import { rpcFail } from './rpc';
import type {
  AgentChatResult,
  AgentChatTool,
  AgentCompleteMessage,
  AgentCompleteResult,
} from './types';

function agentsHttpUrl(): string {
  return (process.env.AGENTS_HTTP_URL ?? 'http://127.0.0.1:3006').replace(/\/+$/, '');
}

/** 通过 MQTT / 内部 HTTP 调 agents，各业务服务共用，不要在业务里再写一份上游调用。 */
@Injectable()
export class AgentsClient implements OnModuleInit {
  constructor(@Inject(AGENTS_CLIENT) private readonly agents: ClientProxy) {}

  async onModuleInit() {
    await this.agents.connect();
  }

  status(): Promise<{ enabled: boolean; model: string; rag?: boolean; embeddingModel?: string }> {
    return this.send(MQTT_PATTERNS.AGENTS_CHAT_STATUS, {}, 10_000);
  }

  chat(input: {
    bizCode: string;
    system?: string;
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
    temperature?: number;
    accountId?: string;
  }): Promise<AgentChatResult> {
    return this.send(MQTT_PATTERNS.AGENTS_CHAT, {
      system: input.system,
      messages: input.messages,
      temperature: input.temperature,
      sync: true,
      _bizCode: input.bizCode,
      _session: input.accountId ? { accountId: input.accountId } : null,
    }, 90_000);
  }

  /** MQTT 不能逐字推流，走 agents 内部 HTTP SSE。 */
  async *streamChat(input: {
    bizCode: string;
    system?: string;
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
    temperature?: number;
    accountId?: string;
  }): AsyncGenerator<string> {
    let upstream: globalThis.Response;
    try {
      upstream = await fetch(`${agentsHttpUrl()}/internal/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system: input.system,
          messages: input.messages,
          temperature: input.temperature,
          sync: false,
          _bizCode: input.bizCode,
          _session: input.accountId ? { accountId: input.accountId } : null,
        }),
      });
    } catch {
      rpcFail(502, '智能体流式入口不可达');
    }
    if (!upstream.ok) {
      const raw = await upstream.text().catch(() => '');
      rpcFail(upstream.status || 502, raw.slice(0, 200) || '智能体流式对话失败');
    }
    if (!upstream.body) {
      rpcFail(502, '智能体未返回流');
    }
    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split(/\r?\n\r?\n/);
      buffer = parts.pop() ?? '';
      for (const block of parts) {
        for (const line of block.split(/\r?\n/)) {
          if (!line.startsWith('data:')) continue;
          const data = line.slice(5).trimStart();
          if (!data || data === '[DONE]') continue;
          try {
            const json = JSON.parse(data) as { delta?: string; error?: string };
            if (json.error) rpcFail(502, json.error);
            if (typeof json.delta === 'string' && json.delta) yield json.delta;
          } catch {
            // 忽略非 JSON 心跳
          }
        }
      }
    }
  }

  transcribe(input: {
    bizCode: string;
    audioBase64?: string;
    mime?: string;
    fileUrl?: string;
    provider?: string;
    accountId?: string;
  }): Promise<{ transcript?: string; provider?: string; jobId?: string; status?: string }> {
    return this.send(MQTT_PATTERNS.AGENTS_SPEECH_TRANSCRIBE, {
      audioBase64: input.audioBase64,
      mime: input.mime,
      fileUrl: input.fileUrl,
      provider: input.provider,
      _bizCode: input.bizCode,
      _session: input.accountId ? { accountId: input.accountId } : null,
    }, 90_000);
  }

  extract(input: {
    bizCode: string;
    system?: string;
    user: string;
    temperature?: number;
    reasoner?: boolean;
    accountId?: string;
  }): Promise<{ text: string; json: unknown; fields: Record<string, unknown> }> {
    return this.send(MQTT_PATTERNS.AGENTS_LANGUAGE_EXTRACT, {
      system: input.system,
      user: input.user,
      temperature: input.temperature,
      reasoner: input.reasoner,
      _bizCode: input.bizCode,
      _session: input.accountId ? { accountId: input.accountId } : null,
    }, 90_000);
  }

  complete(input: {
    bizCode: string;
    messages: AgentCompleteMessage[];
    tools?: AgentChatTool[];
    temperature?: number;
    reasoner?: boolean;
    accountId?: string;
  }): Promise<AgentCompleteResult> {
    return this.send(MQTT_PATTERNS.AGENTS_LANGUAGE_COMPLETE, {
      messages: input.messages,
      tools: input.tools,
      temperature: input.temperature,
      reasoner: input.reasoner,
      _bizCode: input.bizCode,
      _session: input.accountId ? { accountId: input.accountId } : null,
    }, 90_000);
  }

  submitVideo(input: {
    bizCode: string;
    fileUrl: string;
    mime?: string;
    accountId?: string;
  }): Promise<{ jobId: string; status: string; provider: string }> {
    return this.send(MQTT_PATTERNS.AGENTS_VIDEO_SUBMIT, {
      fileUrl: input.fileUrl,
      mime: input.mime,
      _bizCode: input.bizCode,
      _session: input.accountId ? { accountId: input.accountId } : null,
    }, 30_000);
  }

  getMediaJob(input: { bizCode: string; id: string }): Promise<{
    jobId: string;
    status: string;
    kind: string;
    provider: string;
    transcript: string;
    segments: unknown[];
    error?: string;
  }> {
    return this.send(MQTT_PATTERNS.AGENTS_MEDIA_JOB, {
      id: input.id,
      _bizCode: input.bizCode,
    }, 15_000);
  }

  private async send<T>(pattern: string, payload: Record<string, unknown>, timeoutMs: number): Promise<T> {
    try {
      const raw = await lastValueFrom(
        this.agents.send(pattern, payload).pipe(timeout(timeoutMs)),
      );
      return unwrapData<T>(raw);
    } catch (err) {
      if (err instanceof TimeoutError) {
        rpcFail(504, '智能体服务超时');
      }
      const payloadErr = err as { status?: number; message?: string };
      rpcFail(payloadErr?.status ?? 502, payloadErr?.message ?? '智能体服务调用失败');
    }
  }
}
