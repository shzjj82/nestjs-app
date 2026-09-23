import { Injectable, Logger } from '@nestjs/common';
import { rpcFail } from '../rpc';

export interface WechatSession {
  openid: string;
  unionid?: string;
  sessionKey?: string;
}

@Injectable()
export class WechatClient {
  private readonly logger = new Logger('WechatClient');

  async code2session(
    wechatAppId: string,
    wechatSecret: string,
    code: string,
  ): Promise<WechatSession> {
    if (process.env.WECHAT_MOCK === '1') {
      return {
        openid: `mock-${code}`,
        unionid: `union-${code}`,
      };
    }

    const url = new URL('https://api.weixin.qq.com/sns/jscode2session');
    url.searchParams.set('appid', wechatAppId);
    url.searchParams.set('secret', wechatSecret);
    url.searchParams.set('js_code', code);
    url.searchParams.set('grant_type', 'authorization_code');

    let payload: {
      openid?: string;
      unionid?: string;
      session_key?: string;
      errcode?: number;
      errmsg?: string;
    };
    try {
      const res = await fetch(url);
      payload = (await res.json()) as typeof payload;
    } catch (err) {
      this.logger.error(err);
      rpcFail(502, '微信登录接口不可用');
    }

    if (!payload.openid) {
      rpcFail(
        400,
        `微信登录失败: ${payload.errmsg ?? 'invalid code'} (${payload.errcode ?? '-'})`,
      );
    }

    return {
      openid: payload.openid,
      unionid: payload.unionid,
      sessionKey: payload.session_key,
    };
  }
}
