import { Inject, Injectable, Logger } from '@nestjs/common';
import { optionalString, REDIS } from '@app/common';
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

  /**
   * 订阅消息模板清单（按场景分组）。
   * 小程序拿它去调 `wx.requestSubscribeMessage`；没配置的场景值为空串，
   * 前端必须跳过空串，否则基础库会在 success 回调内部抛错且业务 try/catch 抓不到。
   */
  async subscribeTemplates(
    payload: Record<string, unknown>,
  ): Promise<Record<string, string>> {
    const mp = await this.programs.requireEnabled(payload);
    const cfg = mp.subscribeTemplates ?? {};
    // 前端只关心「场景 → 模板 ID」，字段映射是服务端内部的事
    return Object.fromEntries(
      Object.entries(cfg).map(([scene, item]) => [scene, item?.templateId ?? '']),
    );
  }

  /**
   * 发送一条订阅消息。
   *
   * 业务服务只给「场景名 + 收件人 openid + 填充数据」，
   * 模板 ID 由本服务按小程序配置补全 —— 业务服务不需要知道模板 ID。
   */
  async sendSubscribe(payload: Record<string, unknown>): Promise<{
    sent: boolean;
    scene: string;
    templateId: string;
  }> {
    const mp = await this.programs.requireEnabled(payload);
    const touser = this.required(payload.touser ?? payload.openid, 'touser');
    const scene = this.required(payload.scene, 'scene');
    const cfg = mp.subscribeTemplates?.[scene];
    const templateId = optionalString(payload.templateId) ?? cfg?.templateId;
    if (!templateId) {
      rpcFail(
        400,
        `小程序 ${mp.code} 未配置场景 ${scene} 的订阅消息模板，无法发送`,
      );
    }

    // 业务服务给的是语义值（orderCode / title / amount …），按配置填进模板字段
    const values = (payload.values ?? {}) as Record<string, unknown>;
    const data = this.buildTemplateData(cfg?.fields, values);

    const token = await this.accessToken(mp);
    const url = new URL('https://api.weixin.qq.com/cgi-bin/message/subscribe/send');
    url.searchParams.set('access_token', token);
    const body: Record<string, unknown> = {
      touser,
      template_id: templateId,
      data,
      miniprogram_state: optionalString(payload.miniprogramState) ?? 'formal',
      lang: optionalString(payload.lang) ?? 'zh_CN',
    };
    const page = optionalString(payload.page);
    if (page) body.page = page;

    const res = await this.postJson<{
      errcode?: number;
      errmsg?: string;
    }>(url, body);
    if (res.errcode && res.errcode !== 0) {
      // 43101 = 用户拒绝订阅/未授权，属正常情况，不抛错让业务流程继续
      if (res.errcode === 43101) {
        this.logger.warn(`订阅消息未送达（用户未授权）: ${scene} -> ${touser}`);
        return { sent: false, scene, templateId };
      }
      rpcFail(502, `发送订阅消息失败: ${res.errmsg ?? 'unknown'} (${res.errcode})`);
    }
    return { sent: true, scene, templateId };
  }

  /**
   * 语义值 → 微信模板字段。
   * 没有配 fields 时用默认填充（thing1 = 标题），保证模板至少能发得出去。
   */
  private buildTemplateData(
    fields: Record<string, string> | undefined,
    values: Record<string, unknown>,
  ): Record<string, { value: string }> {
    const pick = (key: string): string => {
      const raw = values[key];
      return raw === undefined || raw === null ? '' : String(raw);
    };
    if (fields && Object.keys(fields).length) {
      return Object.fromEntries(
        Object.entries(fields).map(([field, semantic]) => [
          field,
          { value: pick(semantic) },
        ]),
      );
    }
    return { thing1: { value: pick('title') || pick('orderCode') } };
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
