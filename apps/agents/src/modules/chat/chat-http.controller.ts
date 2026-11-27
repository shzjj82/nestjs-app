import { Body, Controller, Post, Res } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import type { Response } from 'express';
import { ChatService } from './chat.service';
import { encodeSse } from '../../http/sse';

@Controller()
export class ChatHttpController {
  constructor(private readonly chat: ChatService) {}

  @Post('internal/chat/stream')
  async stream(@Body() body: unknown, @Res() res: Response) {
    try {
      res.status(200);
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.socket?.setNoDelay(true);
      res.flushHeaders();
      for await (const event of this.chat.streamEvents(body)) {
        writeSse(res, encodeSse(event));
      }
      writeSse(res, encodeSse('[DONE]'));
      res.end();
    } catch (err) {
      const { status, message } = rpcToHttp(err);
      if (!res.headersSent) {
        res.status(status).json({ status, message });
        return;
      }
      writeSse(res, encodeSse({ error: message }));
      writeSse(res, encodeSse('[DONE]'));
      res.end();
    }
  }
}

function writeSse(res: Response, chunk: string) {
  res.write(chunk);
  (res as Response & { flush?: () => void }).flush?.();
}

function rpcToHttp(err: unknown): { status: number; message: string } {
  if (err instanceof RpcException) {
    const payload = err.getError();
    if (typeof payload === 'string') {
      return { status: 502, message: payload };
    }
    if (payload && typeof payload === 'object') {
      const rec = payload as { status?: number; message?: unknown };
      return {
        status: typeof rec.status === 'number' ? rec.status : 502,
        message: rec.message != null ? String(rec.message) : 'AI_UPSTREAM',
      };
    }
  }
  if (err instanceof Error) {
    return { status: 502, message: err.message };
  }
  return { status: 502, message: 'AI_UPSTREAM' };
}
