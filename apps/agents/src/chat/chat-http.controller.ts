import { Body, Controller, Post, Res } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import type { Response } from 'express';
import { ChatService } from './chat.service';
import { encodeSse } from './chat-stream';

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
      res.flushHeaders();
      for await (const event of this.chat.streamEvents(body)) {
        res.write(encodeSse(event));
      }
      res.write(encodeSse('[DONE]'));
      res.end();
    } catch (err) {
      const { status, message } = rpcToHttp(err);
      if (!res.headersSent) {
        res.status(status).json({ status, message });
        return;
      }
      res.write(encodeSse({ error: message }));
      res.write(encodeSse('[DONE]'));
      res.end();
    }
  }
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
