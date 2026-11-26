import {
  BadGatewayException,
  Body,
  Controller,
  HttpException,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  AGENTS_CLIENT,
  MQTT_PATTERNS,
  WIKI_CLIENT,
  fail,
  ok,
  unwrapData,
} from '@app/common';
import type { AgentChatInput, AgentChatResult, ServiceEnvelope } from '@app/common';
import type { Request, Response } from 'express';
import { BizGuard } from '../auth/biz.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { GatewayUser } from '../auth/auth.types';
import { ClientHub } from '../mqtt/client.hub';
import { markWikiCitations } from '../../../wiki/src/chat/inline-cite';
import { requestPathname } from '../proxy/proxy.routes';

function agentsMqttTimeoutMs() {
  const n = Number(process.env.AGENTS_MQTT_TIMEOUT_MS ?? 90_000);
  return Number.isFinite(n) && n > 0 ? n : 90_000;
}

function agentsHttpUrl() {
  return (process.env.AGENTS_HTTP_URL ?? 'http://127.0.0.1:3006').replace(/\/+$/, '');
}

@Controller(['agents', 'wiki/agents'])
export class AgentsOverrideController {
  constructor(
    private readonly clients: ClientHub,
    private readonly biz: BizGuard,
  ) {}

  @Post('chat')
  @UseGuards(JwtAuthGuard)
  async chat(
    @Req() req: Request,
    @Body() body: AgentChatInput,
    @CurrentUser() user: GatewayUser,
    @Res() res: Response,
  ) {
    const bizCode = await this.biz.checkRequest(req, user);
    const payload = {
      ...sanitizeBody(body),
      _bizCode: bizCode,
      _session: {
        userId: user.id,
        accountId: user.accountId,
        appId: user.appId,
        bizCode: user.bizCode ?? bizCode ?? '',
      },
    };
    if (body?.sync === false) {
      // 流式仍直连 agents HTTP。知识库这条先让 wiki 附上待办，写出前再套出处标记。
      const wiki = requestPathname(req).startsWith('/wiki/agents');
      const prepared = wiki ? await this.prepareWikiChat(payload) : payload;
      await this.pipeStream(res, prepared, wiki);
      return;
    }
    const wiki = requestPathname(req).startsWith('/wiki/agents');
    try {
      const raw = await this.clients.send<ServiceEnvelope<AgentChatResult>>(
        wiki ? WIKI_CLIENT : AGENTS_CLIENT,
        wiki ? MQTT_PATTERNS.WIKI_AGENTS_CHAT : MQTT_PATTERNS.AGENTS_CHAT,
        payload,
        agentsMqttTimeoutMs(),
      );
      res.status(200).json(ok(unwrapData(raw)));
    } catch (err) {
      if (err instanceof HttpException) {
        const code = err.getStatus();
        const raw = err.getResponse();
        const message =
          typeof raw === 'string'
            ? raw
            : typeof raw === 'object' && raw && 'message' in raw
              ? String((raw as { message: unknown }).message)
              : err.message;
        res.status(code).json(fail(code, message));
        return;
      }
      throw err;
    }
  }

  private async prepareWikiChat(payload: Record<string, unknown>) {
    try {
      const raw = await this.clients.send<ServiceEnvelope<Record<string, unknown>>>(
        WIKI_CLIENT,
        MQTT_PATTERNS.WIKI_AGENTS_CHAT_PREPARE,
        payload,
        agentsMqttTimeoutMs(),
      );
      const prepared = unwrapData(raw);
      if (prepared && typeof prepared === 'object') {
        return prepared;
      }
    } catch {
      // 待办清单失败时仍按原问题继续对话
    }
    return payload;
  }

  private async pipeStream(res: Response, payload: unknown, wiki = false) {
    let upstream: globalThis.Response;
    try {
      upstream = await fetch(`${agentsHttpUrl()}/internal/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch {
      throw new BadGatewayException('agents 流式入口不可达');
    }
    if (!upstream.ok) {
      const raw = (await upstream.json().catch(() => null)) as { message?: string } | null;
      throw new HttpException(raw?.message ?? '流式对话失败', upstream.status);
    }
    if (!upstream.body) {
      throw new BadGatewayException('agents 未返回流');
    }
    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();
    const reader = upstream.body.getReader();
    if (!wiki) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        res.write(value);
      }
      res.end();
      return;
    }
    const decoder = new TextDecoder();
    let rest = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        rest += decoder.decode();
        if (rest) {
          res.write(rewriteWikiSse(rest));
        }
        break;
      }
      rest += decoder.decode(value, { stream: true });
      const parts = rest.split(/\n\n/);
      rest = parts.pop() ?? '';
      if (parts.length) {
        res.write(`${parts.map(rewriteWikiSse).join('\n\n')}\n\n`);
      }
    }
    res.end();
  }
}

function rewriteWikiSse(block: string): string {
  const lines = block.split('\n');
  const index = lines.findIndex((line) => line.startsWith('data:'));
  if (index < 0) {
    return block;
  }
  const data = lines[index].slice(5).trim();
  if (!data || data === '[DONE]') {
    return block;
  }
  try {
    const event = JSON.parse(data) as { reply?: unknown; sources?: unknown };
    if (typeof event.reply !== 'string') {
      return block;
    }
    event.reply = markWikiCitations(event.reply, event.sources);
    lines[index] = `data: ${JSON.stringify(event)}`;
    return lines.join('\n');
  } catch {
    return block;
  }
}

function sanitizeBody(body: AgentChatInput | Record<string, unknown> | undefined) {
  const raw = body && typeof body === 'object' ? { ...body } : {};
  delete (raw as { _bizCode?: unknown })._bizCode;
  return raw;
}
