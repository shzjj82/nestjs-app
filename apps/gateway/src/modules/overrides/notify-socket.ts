import { HttpException, Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { MqttTopicHub, notifyTopic } from '@app/common';
import type { Duplex } from 'stream';
import type { IncomingMessage, Server } from 'http';
import { WebSocket, WebSocketServer } from 'ws';
import type { Request } from 'express';
import { AuthService } from '../auth/auth.service';
import { BizGuard } from '../auth/biz.guard';

const SOCKET_PATHS = new Set(['/notifications/socket', '/wiki/notifications/socket']);

@Injectable()
export class NotifySocketGateway implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger('NotifySocket');
  private readonly hub = new MqttTopicHub();
  private server?: WebSocketServer;

  constructor(
    private readonly http: HttpAdapterHost,
    private readonly auth: AuthService,
    private readonly biz: BizGuard,
  ) {}

  onApplicationBootstrap() {
    const httpServer = this.http.httpAdapter.getHttpServer() as Server;
    this.server = new WebSocketServer({ noServer: true });
    httpServer.on('upgrade', (req, socket, head) => {
      void this.upgrade(req, socket, head);
    });
    this.logger.log(`WebSocket 已挂载 ${[...SOCKET_PATHS].join(' / ')}`);
  }

  onApplicationShutdown() {
    this.server?.close();
  }

  private async upgrade(req: IncomingMessage, socket: Duplex, head: Buffer) {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (!SOCKET_PATHS.has(url.pathname)) {
      socket.destroy();
      return;
    }
    const token = url.searchParams.get('token') || bearer(req);
    const bizCode = url.searchParams.get('bizCode') || header(req, 'x-biz-code');
    const fake = {
      headers: {
        authorization: token ? `Bearer ${token}` : '',
        'x-biz-code': bizCode,
      },
    } as unknown as Request;

    try {
      const user = await this.auth.fromRequest(fake);
      if (!user) {
        reject(socket, 401, '需要登录');
        return;
      }
      const acceptedBiz = await this.biz.check(
        { method: 'GET', path: url.pathname, scope: 'business' },
        fake,
        user,
      );
      if (!acceptedBiz) {
        reject(socket, 400, '缺少业务标识：bizCode');
        return;
      }
      this.server?.handleUpgrade(req, socket, head, (ws) => {
        void this.bind(ws, acceptedBiz, user.id);
      });
    } catch (err) {
      const status = err instanceof HttpException ? err.getStatus() : 401;
      const message = err instanceof HttpException ? exceptionMessage(err) : '连接失败';
      reject(socket, status, message);
    }
  }

  private async bind(ws: WebSocket, bizCode: string, userId: string) {
    const send = (payload: unknown) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(payload));
      }
    };
    let stop = () => {};
    try {
      stop = await this.hub.listen(notifyTopic(bizCode, userId), (payload) => {
        send({ type: 'event', ...(isRecord(payload) ? payload : { data: payload }) });
      });
      send({ type: 'ready', bizCode, userId });
    } catch (err) {
      send({
        type: 'error',
        message: err instanceof Error ? err.message : '订阅失败',
      });
      ws.close();
      return;
    }

    const timer = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      }
    }, 30000);
    ws.on('close', () => {
      clearInterval(timer);
      stop();
    });
  }
}

function bearer(req: IncomingMessage): string {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return '';
  }
  return header.slice(7).trim();
}

function header(req: IncomingMessage, name: string): string {
  const value = req.headers[name];
  const text = Array.isArray(value) ? value[0] : value;
  return typeof text === 'string' ? text.trim() : '';
}

function reject(socket: Duplex, status: number, message: string) {
  const body = JSON.stringify({ success: false, code: status, message });
  const reason = status === 401 ? 'Unauthorized' : status === 403 ? 'Forbidden' : 'Bad Request';
  socket.write(
    `HTTP/1.1 ${status} ${reason}\r\n` +
      'Connection: close\r\n' +
      'Content-Type: application/json; charset=utf-8\r\n' +
      `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n` +
      body,
  );
  socket.destroy();
}

function exceptionMessage(err: HttpException): string {
  const body = err.getResponse();
  if (typeof body === 'string') {
    return body;
  }
  if (body && typeof body === 'object' && 'message' in body) {
    const message = (body as { message?: unknown }).message;
    return Array.isArray(message) ? message.join(', ') : String(message ?? err.message);
  }
  return err.message;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
