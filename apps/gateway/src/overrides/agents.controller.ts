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
import { AGENTS_CLIENT, MQTT_PATTERNS, fail, ok, unwrapData } from '@app/common';
import type { AgentChatInput, AgentChatResult, ServiceEnvelope } from '@app/common';
import type { Request, Response } from 'express';
import { BizGuard } from '../auth/biz.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { GatewayUser } from '../auth/auth.types';
import { ClientHub } from '../mqtt/client.hub';

function agentsMqttTimeoutMs() {
  const n = Number(process.env.AGENTS_MQTT_TIMEOUT_MS ?? 90_000);
  return Number.isFinite(n) && n > 0 ? n : 90_000;
}

function agentsHttpUrl() {
  return (process.env.AGENTS_HTTP_URL ?? 'http://127.0.0.1:3006').replace(/\/+$/, '');
}

@Controller('agents')
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
    const payload = { ...sanitizeBody(body), _bizCode: bizCode };
    if (body?.sync === false) {
      await this.pipeStream(res, payload);
      return;
    }
    try {
      const raw = await this.clients.send<ServiceEnvelope<AgentChatResult>>(
        AGENTS_CLIENT,
        MQTT_PATTERNS.AGENTS_CHAT,
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

  private async pipeStream(res: Response, payload: unknown) {
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
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      res.write(value);
    }
    res.end();
  }
}

function sanitizeBody(body: AgentChatInput | Record<string, unknown> | undefined) {
  const raw = body && typeof body === 'object' ? { ...body } : {};
  delete (raw as { _bizCode?: unknown })._bizCode;
  return raw;
}
