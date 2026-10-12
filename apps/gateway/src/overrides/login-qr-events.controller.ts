import { Controller, Get, Param, Req, Res } from '@nestjs/common';
import {
  isLoginQrScene,
  loginQrMqttTopic,
  MQTT_PATTERNS,
  subscribeMqttJson,
  USER_CLIENT,
  unwrapData,
  type LoginQrEvent,
  type LoginQrStatusResult,
} from '@app/common';
import type { Request, Response } from 'express';
import { BizGuard } from '../auth/biz.guard';
import { ClientHub } from '../mqtt/client.hub';

/**
 * 登录小程序码实时通道：网关把 MQTT `auth/login/qr/{ticket}` 转成 SSE。
 * 浏览器也可用 mqtt.js 直连 Mosquitto WebSocket（默认 :9001）订阅同一 topic。
 */
@Controller('auth/login/qrcode')
export class LoginQrEventsController {
  constructor(
    private readonly clients: ClientHub,
    private readonly biz: BizGuard,
  ) {}

  @Get(':ticket/events')
  async events(
    @Param('ticket') ticket: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    if (!isLoginQrScene(ticket)) {
      res.status(400).json({ success: false, code: 400, message: '不是登录二维码' });
      return;
    }
    await this.biz.checkRequest(req, null);

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const write = (payload: unknown) => {
      if (res.writableEnded) {
        return;
      }
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    try {
      const status = unwrapData<LoginQrStatusResult>(
        await this.clients.send(USER_CLIENT, MQTT_PATTERNS.AUTH_LOGIN_QR_STATUS, {
          ticket,
          _bizCode: this.biz.headerCode(req),
        }),
      );
      write({
        purpose: 'login',
        ticket: status.ticket,
        status: status.status,
        at: new Date().toISOString(),
        auth: status.auth,
      } satisfies LoginQrEvent);
      if (status.status === 'confirmed' || status.status === 'expired') {
        res.end();
        return;
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : '读取登录码状态失败';
      write({ purpose: 'login', ticket, status: 'expired', at: new Date().toISOString(), error: message });
      res.end();
      return;
    }

    const topic = loginQrMqttTopic(ticket);
    let unsubscribe: (() => void) | undefined;
    try {
      unsubscribe = await subscribeMqttJson(topic, (payload) => {
        write(payload);
        const status = (payload as LoginQrEvent | undefined)?.status;
        if (status === 'confirmed' || status === 'expired') {
          res.end();
          unsubscribe?.();
        }
      });
    } catch (err) {
      write({
        purpose: 'login',
        ticket,
        status: 'pending',
        at: new Date().toISOString(),
        error: err instanceof Error ? err.message : 'MQTT 订阅失败，请改用轮询',
      });
    }

    const heartbeat = setInterval(() => {
      if (!res.writableEnded) {
        res.write(': ping\n\n');
      }
    }, 15000);

    req.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe?.();
      if (!res.writableEnded) {
        res.end();
      }
    });
  }
}
