import { Injectable, Logger } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import type {
  AgentChatInput,
  AgentChatResult,
  AgentChatStreamEvent,
  AgentRagSource,
} from '@app/common';
import { asRecord } from '../common/rpc';
import { rpcFail } from '../common/rpc';
import { RagPort } from '../rag/rag-port';
import { aiApiBase, aiApiKey, aiConfigured, aiModel, aiTimeoutMs } from './chat-env';
import { parseChatInput } from './chat-input';
import {
  DEFAULT_SYSTEM,
  RAG_SYSTEM_APPENDIX,
  buildHistoryMessages,
  contextAppendix,
  describeAttachments,
  ragContextAppendix,
  type UpstreamMessage,
} from './chat-messages';
import { contentFromUpstreamData, splitSseBlocks } from './chat-stream';

@Injectable()
export class ChatService {
  private readonly logger = new Logger('AgentsChat');

  constructor(private readonly rag: RagPort) {}

  status() {
    const rag = this.rag.status();
    return {
      enabled: aiConfigured(),
      model: aiModel(),
      rag: rag.enabled,
      embeddingModel: rag.embeddingModel,
    };
  }

  async complete(payload: unknown): Promise<AgentChatResult> {
    this.assertConfigured();
    return this.run(parseChatInput(payload), payload);
  }

  async *streamEvents(payload: unknown): AsyncGenerator<AgentChatStreamEvent> {
    this.assertConfigured();
    const input = parseChatInput(payload);
    const prepared = await this.prepare(input, payload);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), aiTimeoutMs());
    try {
      let reply = '';
      try {
        for await (const delta of this.iterateUpstream(
          prepared.imageUrls.length ? prepared.withVision : prepared.textOnly,
          controller.signal,
        )) {
          reply += delta;
          yield { delta };
        }
      } catch (err) {
        if (prepared.imageUrls.length && reply === '' && isUpstreamError(err)) {
          for await (const delta of this.iterateUpstream(prepared.textOnly, controller.signal)) {
            reply += delta;
            yield { delta };
          }
        } else {
          throw err;
        }
      }
      if (!reply) {
        rpcFail(502, 'AI_EMPTY');
      }
      yield { reply: reply.slice(0, 12000) };
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        rpcFail(504, 'AI_TIMEOUT');
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  async run(input: AgentChatInput, rawPayload?: unknown): Promise<AgentChatResult> {
    this.assertConfigured();
    const prepared = await this.prepare(input, rawPayload ?? input);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), aiTimeoutMs());
    try {
      let reply = '';
      try {
        reply = await this.callModel(
          prepared.imageUrls.length ? prepared.withVision : prepared.textOnly,
          controller.signal,
          false,
        );
      } catch (err) {
        if (prepared.imageUrls.length && isUpstreamError(err)) {
          reply = await this.callModel(prepared.textOnly, controller.signal, false);
        } else {
          throw err;
        }
      }
      if (!reply) {
        rpcFail(502, 'AI_EMPTY');
      }
      const result: AgentChatResult = { reply: reply.slice(0, 12000) };
      if (prepared.sources.length) {
        result.sources = prepared.sources;
      }
      return result;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        rpcFail(504, 'AI_TIMEOUT');
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  assertConfigured() {
    if (!aiConfigured()) {
      rpcFail(503, 'AI_NOT_CONFIGURED');
    }
  }

  private async prepare(input: AgentChatInput, rawPayload: unknown) {
    const attachments = input.attachments ?? [];
    const { imageUrls } = describeAttachments(attachments);
    let appendix = contextAppendix(attachments);
    let system = input.system?.trim() || DEFAULT_SYSTEM;
    let sources: AgentRagSource[] = [];

    if (input.rag === true) {
      const lastUser = [...input.messages].reverse().find((item) => item.role === 'user');
      const query = lastUser?.content?.trim() ?? '';
      if (query) {
        sources = await this.rag.searchForChat({
          payload: asRecord(rawPayload),
          query,
          topK: input.ragTopK,
        });
        const ragAppendix = ragContextAppendix(sources);
        if (ragAppendix) {
          system = `${system}\n\n${RAG_SYSTEM_APPENDIX}`;
          appendix = [appendix, ragAppendix].filter(Boolean).join('\n\n');
        }
      }
    }

    return {
      imageUrls,
      sources,
      withVision: buildHistoryMessages(system, input.messages, appendix, imageUrls, true),
      textOnly: buildHistoryMessages(system, input.messages, appendix, imageUrls, false),
    };
  }

  private async callModel(
    messages: UpstreamMessage[],
    signal: AbortSignal,
    stream: boolean,
  ): Promise<string> {
    const res = await this.postCompletions(messages, signal, stream);
    if (stream) {
      return '';
    }
    const payload = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return payload.choices?.[0]?.message?.content?.trim() ?? '';
  }

  private async *iterateUpstream(
    messages: UpstreamMessage[],
    signal: AbortSignal,
  ): AsyncGenerator<string> {
    const res = await this.postCompletions(messages, signal, true);
    if (!res.body) {
      rpcFail(502, 'AI_EMPTY');
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      const split = splitSseBlocks(buffer);
      buffer = split.rest;
      for (const data of split.events) {
        const delta = contentFromUpstreamData(data);
        if (delta) {
          yield delta;
        }
      }
    }
  }

  private async postCompletions(
    messages: UpstreamMessage[],
    signal: AbortSignal,
    stream: boolean,
  ): Promise<Response> {
    const res = await fetch(`${aiApiBase()}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${aiApiKey()}`,
      },
      body: JSON.stringify({
        model: aiModel(),
        temperature: 0.7,
        messages,
        stream,
      }),
      signal,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      this.logger.error(`AI upstream error ${res.status} ${detail.slice(0, 500)}`);
      rpcFail(502, `AI_UPSTREAM_${res.status}`);
    }
    return res;
  }
}

function isUpstreamError(err: unknown): boolean {
  const messages: string[] = [];
  if (err instanceof Error) {
    messages.push(err.message);
  }
  if (err instanceof RpcException) {
    const payload = err.getError();
    if (typeof payload === 'string') {
      messages.push(payload);
    } else if (payload && typeof payload === 'object' && 'message' in payload) {
      messages.push(String((payload as { message: unknown }).message));
    }
  }
  return messages.some((item) => item.includes('AI_UPSTREAM_'));
}
