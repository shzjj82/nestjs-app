import { Injectable, Logger } from '@nestjs/common';
import { rpcFail } from '../rpc';

export interface AlipaySession {
  userId: string;
}

@Injectable()
export class AlipayClient {
  private readonly logger = new Logger('AlipayClient');

  async code2session(
    alipayAppId: string,
    _alipayPrivateKey: string,
    code: string,
  ): Promise<AlipaySession> {
    if (process.env.ALIPAY_MOCK === '1' || process.env.WECHAT_MOCK === '1') {
      return { userId: `mock-alipay-${alipayAppId}-${code}` };
    }

    this.logger.warn('支付宝正式换票尚未接入，请先配置 ALIPAY_MOCK=1 或补齐开放平台调用');
    rpcFail(501, `支付宝登录未配置: ${alipayAppId}`);
  }
}
