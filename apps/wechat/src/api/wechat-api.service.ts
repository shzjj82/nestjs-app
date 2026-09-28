import { Inject, Injectable, Logger } from '@nestjs/common';
import { REDIS } from '@app/common';
import type Redis from 'ioredis';
import { rpcFail } from '../common/rpc';
import type { MiniProgramEntity } from '../entities';
import { MiniProgramsService } from '../miniprograms/miniprograms.service';

export interface WechatSessionResult {
  openid: string;
  unionid?: string;
  sessionKey?: string;
  appId: string;
}

@Injectable()
export class WechatApiService {
  private readonly logger = new Logger('WechatApi');

  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    private readonly programs: MiniProgramsService,
  ) {}

  async code2session(payload: Record<string, unknown>): Promise<WechatSessionResult> {
    const mp = await this.programs.requireEnabled(payload);
    const jsCode = this.required(payload.jsCode ?? payload.code, 'code');
    const url = new URL('https://api.weixin.qq.com/sns/jscode2session');
    url.searchParams.set('appid', mp.appId);
    url.searchParams.set('secret', mp.secret);
    url.searchParams.set('js_code', jsCode);
    url.searchParams.set('grant_type', 'authorization_code');
    const data = await this.getJson<{
      openid?: string;
      unionid?: string;
      session_key?: string;
      errcode?: number;
      errmsg?: string;
    }>(url);
    if (!data.openid) {
      rpcFail(400, `微信登录失败: ${data.errmsg ?? 'invalid code'} (${data.errcode ?? '-'})`);
    }
    return {
      openid: data.openid,
      unionid: data.unionid,
      sessionKey: data.session_key,
      appId: mp.appId,
    };
  }

  async qrcode(payload: Record<string, unknown>) {
    const mp = await this.programs.requireEnabled(payload);
    const scene = this.required(payload.scene, 'scene');
    if (scene.length > 32) {
      rpcFail(400, 'scene 最多 32 个字符');
    }
    const token = await this.accessToken(mp);
    const url = new URL('https://api.weixin.qq.com/wxa/getwxacodeunlimit');
    url.searchParams.set('access_token', token);
    const body = {
      scene,
      page: typeof payload.page === 'string' ? payload.page : undefined,
      check_path: payload.checkPath !== false,
      env_version: typeof payload.envVersion === 'string' ? payload.envVersion : 'release',
      width: Number(payload.width) > 0 ? Number(payload.width) : 280,
    };
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const buffer = Buffer.from(await res.arrayBuffer());
    if (this.looksJson(buffer)) {
      const err = JSON.parse(buffer.toString('utf8')) as {
        errcode?: number;
        errmsg?: string;
      };
      rpcFail(400, `小程序码失败: ${err.errmsg ?? 'unknown'} (${err.errcode ?? '-'})`);
    }
    return {
      mime: 'image/png',
      filename: `qrcode-${mp.code}.png`,
      base64: buffer.toString('base64'),
    };
  }

  async phone(payload: Record<string, unknown>) {
    const mp = await this.programs.requireEnabled(payload);
    const code = this.required(payload.phoneCode, 'phoneCode');
    const token = await this.accessToken(mp);
    const url = new URL(
      'https://api.weixin.qq.com/wxa/business/getuserphonenumber',
    );
    url.searchParams.set('access_token', token);
    const data = await this.postJson<{
      errcode?: number;
      errmsg?: string;
      phone_info?: {
        phoneNumber?: string;
        purePhoneNumber?: string;
        countryCode?: string;
      };
    }>(url, { code });
    if (data.errcode && data.errcode !== 0) {
      rpcFail(400, `获取手机号失败: ${data.errmsg ?? 'unknown'} (${data.errcode})`);
    }
    const info = data.phone_info;
    if (!info?.phoneNumber) {
      rpcFail(400, '微信未返回手机号');
    }
    return {
      phone: info.phoneNumber,
      countryCode: info.countryCode,
      purePhone: info.purePhoneNumber,
    };
  }

  async accessToken(mp: MiniProgramEntity): Promise<string> {
    const cacheKey = `wechat:access:${mp.appId}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return cached;
    }
    const url = new URL('https://api.weixin.qq.com/cgi-bin/token');
    url.searchParams.set('grant_type', 'client_credential');
    url.searchParams.set('appid', mp.appId);
    url.searchParams.set('secret', mp.secret);
    const data = await this.getJson<{
      access_token?: string;
      expires_in?: number;
      errcode?: number;
      errmsg?: string;
    }>(url);
    if (!data.access_token) {
      rpcFail(502, `获取 access_token 失败: ${data.errmsg ?? 'unknown'} (${data.errcode ?? '-'})`);
    }
    const ttl = Math.max(60, (data.expires_in ?? 7200) - 120);
    await this.redis.set(cacheKey, data.access_token, 'EX', ttl);
    return data.access_token;
  }

  private required(value: unknown, label: string): string {
    if (typeof value !== 'string' || !value.trim()) {
      rpcFail(400, `${label} 必填`);
    }
    return value.trim();
  }

  private looksJson(buffer: Buffer): boolean {
    const head = buffer.subarray(0, 8).toString('utf8').trimStart();
    return head.startsWith('{') || head.startsWith('[');
  }

  private async getJson<T>(url: URL): Promise<T> {
    try {
      const res = await fetch(url);
      return (await res.json()) as T;
    } catch (err) {
      this.logger.error(err);
      rpcFail(502, '微信接口不可用');
    }
  }

  private async postJson<T>(url: URL, body: unknown): Promise<T> {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      return (await res.json()) as T;
    } catch (err) {
      this.logger.error(err);
      rpcFail(502, '微信接口不可用');
    }
  }
}
