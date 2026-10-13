import { Controller, UseInterceptors } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { ApiDoc, MQTT_PATTERNS, WechatHandleLogInterceptor } from '@app/common';
import { wechatPattern } from '../common/rpc';
import { TransferService } from './transfer.service';

@Controller()
@UseInterceptors(WechatHandleLogInterceptor)
export class TransferController {
  constructor(private readonly transfer: TransferService) {}

  @MessagePattern(wechatPattern(MQTT_PATTERNS.WECHAT_TRANSFER_CREATE))
  @ApiDoc({
    name: '发起商家转账',
    description:
      '用户确认收款模式；返回 packageInfo 供小程序 wx.requestMerchantTransfer',
  })
  create(payload: Record<string, unknown>) {
    return this.transfer.create(payload);
  }

  @MessagePattern(wechatPattern(MQTT_PATTERNS.WECHAT_TRANSFER_QUERY))
  @ApiDoc({
    name: '查询商家转账单',
    description: '按商户单号查单，用于同步收款确认结果',
  })
  query(payload: Record<string, unknown>) {
    return this.transfer.query(payload);
  }
}
