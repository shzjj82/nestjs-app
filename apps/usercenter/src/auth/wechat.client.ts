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
}
