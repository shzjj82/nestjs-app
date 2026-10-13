import { createPrivateKey, createSign, randomBytes } from 'crypto';
import { Logger } from '@nestjs/common';
import type { WechatPayMerchantConfig } from '@app/common';
import { rpcFail } from '../common/rpc';

const HOST = 'https://api.mch.weixin.qq.com';

/**
 * 微信支付 APIv3：WECHATPAY2-SHA256-RSA2048 签名请求。
 * 只覆盖商家转账所需的 POST/GET，不引入第三方 SDK。
 */
export class WechatPayClient {
  private readonly logger = new Logger(WechatPayClient.name);
  private readonly privateKey;

  constructor(private readonly cfg: WechatPayMerchantConfig) {
    try {
      this.privateKey = createPrivateKey(cfg.privateKeyPem);
    } catch (err) {
      this.logger.error(err);
      rpcFail(
        503,
        `微信支付商户私钥无效：${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  get mchId(): string {
    return this.cfg.mchId;
  }

  async postJson<T>(path: string, body: unknown): Promise<T> {
    const payload = JSON.stringify(body);
    return this.request<T>('POST', path, payload);
  }

  async getJson<T>(path: string): Promise<T> {
    return this.request<T>('GET', path, '');
  }

  private async request<T>(
    method: 'GET' | 'POST',
    path: string,
    body: string,
  ): Promise<T> {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const nonce = randomBytes(16).toString('hex');
    const message = `${method}\n${path}\n${timestamp}\n${nonce}\n${body}\n`;
    const signature = createSign('RSA-SHA256')
      .update(message)
      .sign(this.privateKey, 'base64');
    const authorization =
      `WECHATPAY2-SHA256-RSA2048 mchid="${this.cfg.mchId}",` +
      `nonce_str="${nonce}",signature="${signature}",` +
      `timestamp="${timestamp}",serial_no="${this.cfg.serialNo}"`;

    const headers: Record<string, string> = {
      Authorization: authorization,
      Accept: 'application/json',
      'User-Agent': 'nestjs-wechat-pay/1.0',
    };
    if (method === 'POST') {
      headers['Content-Type'] = 'application/json';
    }
    if (this.cfg.publicKeyId) {
      headers['Wechatpay-Serial'] = this.cfg.publicKeyId;
    }

    let res: Response;
    try {
      res = await fetch(`${HOST}${path}`, {
        method,
        headers,
        body: method === 'POST' ? body : undefined,
      });
    } catch (err) {
      this.logger.error(err);
      rpcFail(502, '微信支付接口不可用');
    }

    const text = await res.text();
    let data: Record<string, unknown> = {};
    if (text) {
      try {
        data = JSON.parse(text) as Record<string, unknown>;
      } catch {
        rpcFail(502, `微信支付返回非 JSON（HTTP ${res.status}）`);
      }
    }
    if (!res.ok) {
      const code = String(data.code ?? res.status);
      const messageText = String(data.message ?? text ?? 'unknown');
      this.logger.warn(`微信支付失败 ${method} ${path}: ${code} ${messageText}`);
      rpcFail(502, `微信支付失败: ${messageText} (${code})`);
    }
    return data as T;
  }
}
