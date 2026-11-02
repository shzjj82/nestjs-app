import { Injectable } from '@nestjs/common';
import {
  buildChatBody,
  detectLlmFamily,
  textFromMessage,
} from '@app/common';
import { asRecord, optionalString, rpcFail } from '../common/rpc';
import { requireBizCode } from '../common/biz-scope';
import {
  aiApiBase,
  aiApiKey,
  aiConfigured,
  aiModel,
  aiReasonerModel,
  aiTimeoutMs,
} from '../chat/chat-env';
import { extractJson } from '../vision/extract-json';

@Injectable()
export class LanguageService {
  async extract(payload: unknown) {
    requireBizCode(payload);
    if (!aiConfigured()) rpcFail(503, '未配置 AI_API_KEY');
    const body = asRecord(payload);
    const system = optionalString(body.system);
    const user = optionalString(body.user) || optionalString(body.text);
    if (!user) rpcFail(400, '没有可解析的内容');
    const result = await this.callModel({
      messages: [
        ...(system ? [{ role: 'system', content: system }] : []),
        { role: 'user', content: user },
      ],
      temperature: Number(body.temperature),
      reasoner: body.reasoner === true,
      model: optionalString(body.model),
    });
    let json: unknown = null;
    try {
      json = extractJson(result.content);
    } catch {
      json = null;
    }
    return { text: result.content, json, fields: asRecord(json) };
  }

  async complete(payload: unknown) {
    requireBizCode(payload);
    if (!aiConfigured()) rpcFail(503, '未配置 AI_API_KEY');
    const body = asRecord(payload);
    const messages = Array.isArray(body.messages) ? body.messages : [];
    if (!messages.length) rpcFail(400, '没有对话内容');
    const tools = Array.isArray(body.tools) ? body.tools : undefined;
    return this.callModel({
      messages,
      tools,
      temperature: Number(body.temperature),
      reasoner: body.reasoner === true,
      model: optionalString(body.model),
    });
  }

  private async callModel(input: {
    messages: unknown[];
    tools?: unknown[];
    temperature: number;
    reasoner: boolean;
    model?: string;
  }) {
    const model = input.model || (input.reasoner ? aiReasonerModel() : aiModel());
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), aiTimeoutMs());
    try {
      const res = await fetch(`${aiApiBase()}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${aiApiKey()}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify(
          buildChatBody({
            family: detectLlmFamily(model, aiApiBase()),
            model,
            messages: input.messages,
            stream: false,
            reasoner: input.reasoner,
            temperature: Number.isFinite(input.temperature) ? input.temperature : 0.2,
            tools: input.tools,
          }),
        ),
      });
      const raw = await res.text();
      if (!res.ok) {
        rpcFail(502, `语言模型 ${res.status}: ${raw.slice(0, 200)}`);
      }
      const data = safeJson(raw);
      const choices = data.choices;
      const first = Array.isArray(choices) ? (choices[0] as Record<string, unknown> | undefined) : undefined;
      const message = (first?.message ?? {}) as Record<string, unknown> & {
        tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }>;
      };
      const content = textFromMessage(message).trim();
      if (!content && !(message.tool_calls?.length)) {
        rpcFail(502, '语言模型没有返回内容');
      }
      return { content, toolCalls: message.tool_calls ?? [] };
    } catch (error) {
      if (error && typeof error === 'object' && 'status' in error) throw error;
      if (error instanceof Error && error.name === 'AbortError') rpcFail(504, '语言模型超时');
      rpcFail(502, '语言模型暂时不可用');
    } finally {
      clearTimeout(timer);
    }
  }
}

function safeJson(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}
