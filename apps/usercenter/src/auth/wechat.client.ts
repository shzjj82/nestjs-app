import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { MQTT_PATTERNS, WECHAT_CLIENT, unwrapData } from '@app/common';
import type { WechatSession } from '@app/common';
import { lastValueFrom, TimeoutError } from 'rxjs';
import { timeout } from 'rxjs/operators';
import { rpcFail } from '../rpc';

@Injectable()
export class WechatClient implements OnModuleInit {
  constructor(@Inject(WECHAT_CLIENT) private readonly wechat: ClientProxy) {}

  async onModuleInit() {
    await this.wechat.connect();
  }

  async code2session(appId: string, jsCode: string): Promise<WechatSession> {
    try {
      const raw = await lastValueFrom(
        this.wechat
          .send<WechatSession>(MQTT_PATTERNS.WECHAT_CODE2SESSION, {
            appId,
            jsCode,
          })
          .pipe(timeout(8000)),
      );
      const session = unwrapData<WechatSession>(raw);
      if (!session?.openid) {
        rpcFail(400, '微信登录失败：未返回 openid');
      }
      return session;
    } catch (err) {
      if (err instanceof TimeoutError) {
        rpcFail(504, '微信服务超时');
      }
      const payload = err as { status?: number; message?: string };
      rpcFail(
        payload?.status ?? 502,
        payload?.message ?? '微信登录失败',
      );
    }
  }

  async qrcode(input: {
    appId: string;
    scene: string;
    page?: string;
    envVersion?: string;
    width?: number;
    checkPath?: boolean;
  }): Promise<{ mime: string; filename: string; base64: string }> {
    try {
      const raw = await lastValueFrom(
        this.wechat
          .send(MQTT_PATTERNS.WECHAT_QRCODE, {
            appId: input.appId,
            scene: input.scene,
            page: input.page,
            envVersion: input.envVersion ?? 'release',
            width: input.width ?? 280,
            ...(input.checkPath !== undefined
              ? { checkPath: input.checkPath }
              : {}),
          })
          .pipe(timeout(15000)),
      );
      const file = unwrapData<{ mime: string; filename: string; base64: string }>(
        raw,
      );
      if (!file?.base64) {
        rpcFail(502, '微信小程序码未返回图片');
      }
      return file;
    } catch (err) {
      if (err instanceof TimeoutError) {
        rpcFail(504, '微信服务超时');
      }
      const payload = err as { status?: number; message?: string };
      rpcFail(payload?.status ?? 502, payload?.message ?? '生成小程序码失败');
    }
  }
}
