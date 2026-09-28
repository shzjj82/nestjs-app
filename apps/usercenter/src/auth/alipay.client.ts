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
    _code: string,
  ): Promise<AlipaySession> {
    this.logger.warn(`支付宝正式换票尚未接入: ${alipayAppId}`);
    rpcFail(501, '支付宝登录尚未接入');
  }
}
