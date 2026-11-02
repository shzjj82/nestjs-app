import {
  BadGatewayException,
  Body,
  Controller,
  HttpException,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { fail } from '@app/common';
import type { Request, Response } from 'express';
import { AuthService } from '../auth/auth.service';
import { BizGuard } from '../auth/biz.guard';

function medicalHttpUrl() {
  return (process.env.MEDICAL_HTTP_URL ?? 'http://127.0.0.1:3011').replace(/\/+$/, '');
}

/**
 * MQTT 不能流式推送。诊所对话走 medical 内部 HTTP SSE，再由网关转给前端。
 */
@Controller('medical/ai')
export class MedicalChatOverrideController {
  constructor(
    private readonly auth: AuthService,
    private readonly biz: BizGuard,
  ) {}

  @Post('chat')
  async chat(
    @Req() req: Request,
    @Body() body: Record<string, unknown>,
    @Res() res: Response,
  ) {
    const bizCode = await this.biz.checkRequest(req, null);
    const payload = {
      ...(body && typeof body === 'object' ? body : {}),
      _token: this.auth.bearerToken(req),
      _bizCode: bizCode,
    };
    try {
      await this.pipeStream(res, payload);
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
        if (!res.headersSent) res.status(code).json(fail(code, message));
        return;
      }
      throw err;
    }
  }

  private async pipeStream(res: Response, payload: unknown) {
    let upstream: globalThis.Response;
    try {
      upstream = await fetch(`${medicalHttpUrl()}/internal/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch {
      throw new BadGatewayException('medical 流式入口不可达');
    }
    if (!upstream.ok) {
      const raw = (await upstream.json().catch(() => null)) as { message?: string } | null;
      throw new HttpException(raw?.message ?? '流式对话失败', upstream.status);
    }
    if (!upstream.body) {
      throw new BadGatewayException('medical 未返回流');
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
      if (done) break;
      res.write(value);
    }
    res.end();
  }
}
