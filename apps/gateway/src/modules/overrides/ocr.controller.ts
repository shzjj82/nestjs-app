import {
  BadGatewayException,
  Body,
  Controller,
  Get,
  HttpException,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ok, unwrapData, WIKI_CLIENT, AGENTS_CLIENT, MQTT_PATTERNS } from '@app/common';
import type { Request, Response } from 'express';
import { BizGuard } from '../auth/biz.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { GatewayUser } from '../auth/auth.types';
import { ClientHub } from '../mqtt/client.hub';
import { requestPathname } from '../proxy/proxy.routes';

const SYNC_MS = 180_000;

function agentsHttpUrl() {
  return (process.env.AGENTS_HTTP_URL ?? 'http://127.0.0.1:3006').replace(/\/+$/, '');
}

@Controller(['agents', 'wiki/agents'])
@UseGuards(JwtAuthGuard)
export class OcrOverrideController {
  constructor(
    private readonly clients: ClientHub,
    private readonly biz: BizGuard,
  ) {}

  @Post('ocr')
  async recognize(@Req() req: Request, @Body() body: unknown, @CurrentUser() user: GatewayUser) {
    return this.send(req, user, 'sync', body);
  }

  @Post('ocr/tasks')
  async createTask(@Req() req: Request, @Body() body: unknown, @CurrentUser() user: GatewayUser) {
    return this.send(req, user, 'create', body);
  }

  @Get('ocr/tasks/:id')
  async findTask(
    @Req() req: Request,
    @Param('id') id: string,
    @CurrentUser() user: GatewayUser,
  ) {
    return this.send(req, user, 'find', { id });
  }

  @Post('ocr/stream')
  async stream(
    @Req() req: Request,
    @Body() body: unknown,
    @CurrentUser() user: GatewayUser,
    @Res() res: Response,
  ) {
    const payload = await this.payload(req, user, body);
    let upstream: globalThis.Response;
    try {
      upstream = await fetch(`${agentsHttpUrl()}/internal/ocr/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch {
      throw new BadGatewayException('agents 识图流不可达');
    }
    if (!upstream.ok) {
      const raw = (await upstream.json().catch(() => null)) as { message?: string } | null;
      throw new HttpException(raw?.message ?? '识图流失败', upstream.status);
    }
    if (!upstream.body) {
      throw new BadGatewayException('agents 未返回识图流');
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

  private async send(
    req: Request,
    user: GatewayUser,
    kind: 'sync' | 'create' | 'find',
    body: unknown,
  ) {
    const payload = await this.payload(req, user, body);
    const wiki = requestPathname(req).startsWith('/wiki/agents');
    const pattern = wiki
      ? kind === 'create'
        ? MQTT_PATTERNS.WIKI_AGENTS_OCR_TASK_CREATE
        : kind === 'find'
          ? MQTT_PATTERNS.WIKI_AGENTS_OCR_TASK_FIND
          : MQTT_PATTERNS.WIKI_AGENTS_OCR
      : kind === 'create'
        ? MQTT_PATTERNS.AGENTS_OCR_TASK_CREATE
        : kind === 'find'
          ? MQTT_PATTERNS.AGENTS_OCR_TASK_FIND
          : MQTT_PATTERNS.AGENTS_OCR;
    const raw = await this.clients.send(
      wiki ? WIKI_CLIENT : AGENTS_CLIENT,
      pattern,
      payload,
      kind === 'sync' ? SYNC_MS : 15_000,
    );
    return ok(unwrapData(raw));
  }

  private async payload(req: Request, user: GatewayUser, body: unknown) {
    const bizCode = await this.biz.checkRequest(req, user);
    const record = body && typeof body === 'object' ? { ...(body as object) } : {};
    delete (record as { _bizCode?: unknown })._bizCode;
    return {
      ...record,
      _bizCode: bizCode,
      _session: {
        userId: user.id,
        accountId: user.accountId,
        appId: user.appId,
        bizCode: user.bizCode ?? bizCode ?? '',
      },
    };
  }
}
