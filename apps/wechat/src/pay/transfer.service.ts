import { Injectable, Logger } from '@nestjs/common';
import {
  wechatPayMerchantConfig,
  type WechatPayMerchantConfig,
} from '@app/common';
import { optionalString, requiredString, rpcFail } from '../common/rpc';
import { MiniProgramsService } from '../miniprograms/miniprograms.service';
import { WechatPayClient } from './wechat-pay.client';

const CREATE_PATH = '/v3/fund-app/mch-transfer/transfer-bills';
const QUERY_PATH_PREFIX =
  '/v3/fund-app/mch-transfer/transfer-bills/out-bill-no/';

export interface MerchantTransferResult {
  mchId: string;
  appId: string;
  outBillNo: string;
  transferBillNo: string | null;
  state: string;
  packageInfo: string | null;
  failReason: string | null;
  createTime: string | null;
}

@Injectable()
export class TransferService {
  private readonly logger = new Logger(TransferService.name);

  constructor(private readonly programs: MiniProgramsService) {}

  /**
   * 发起商家转账（用户确认收款模式）。
   * 成功且 state=WAIT_USER_CONFIRM 时返回 package_info，供小程序
   * wx.requestMerchantTransfer 使用。
   */
  async create(payload: Record<string, unknown>): Promise<MerchantTransferResult> {
    try {
      const cfg = this.requireConfig();
      const mp = await this.programs.requireEnabled(payload);
      const openid = requiredString(payload.openid, 'openid');
      const outBillNo = requiredString(
        payload.outBillNo ?? payload.out_bill_no,
        'outBillNo',
      );
      if (!/^[0-9A-Za-z]+$/.test(outBillNo) || outBillNo.length > 32) {
        rpcFail(400, 'outBillNo 只能是数字字母且不超过 32 位');
      }
      const amount = Number(payload.transferAmount ?? payload.amount);
      if (!Number.isInteger(amount) || amount <= 0) {
        rpcFail(400, 'transferAmount 必须是正整数（分）');
      }
      if (amount >= 200_000) {
        rpcFail(400, '单笔 ≥2000 元需实名校验，当前未支持 user_name 加密传参');
      }
      const remark =
        optionalString(payload.transferRemark ?? payload.remark) ?? '回收款';
      if (remark.length > 32) {
        rpcFail(400, 'transferRemark 最多 32 个字符');
      }

      const body: Record<string, unknown> = {
        appid: mp.appId,
        out_bill_no: outBillNo,
        transfer_scene_id: cfg.transferSceneId,
        openid,
        transfer_amount: amount,
        transfer_remark: remark,
        transfer_scene_report_infos: cfg.transferReportInfos,
      };
      if (cfg.transferNotifyUrl) {
        body.notify_url = cfg.transferNotifyUrl;
      }
      if (cfg.userRecvPerception) {
        body.user_recv_perception = cfg.userRecvPerception;
      }

      const client = new WechatPayClient(cfg);
      const raw = await client.postJson<{
        out_bill_no?: string;
        transfer_bill_no?: string;
        create_time?: string;
        state?: string;
        package_info?: string;
        fail_reason?: string;
      }>(CREATE_PATH, body);

      this.logger.log(
        `发起转账 ${outBillNo} state=${raw.state ?? '-'} amount=${amount}`,
      );
      return this.toResult(client.mchId, mp.appId, raw, outBillNo);
    } catch (err) {
      this.rethrowRpc(err, '发起商家转账失败');
    }
  }

  /** 按商户单号查单（用于确认收款后同步终态） */
  async query(payload: Record<string, unknown>): Promise<MerchantTransferResult> {
    try {
      const cfg = this.requireConfig();
      const mp = await this.programs.requireEnabled(payload);
      const outBillNo = requiredString(
        payload.outBillNo ?? payload.out_bill_no,
        'outBillNo',
      );
      const client = new WechatPayClient(cfg);
      const path = `${QUERY_PATH_PREFIX}${encodeURIComponent(outBillNo)}`;
      const raw = await client.getJson<{
        out_bill_no?: string;
        transfer_bill_no?: string;
        create_time?: string;
        state?: string;
        package_info?: string;
        fail_reason?: string;
      }>(path);
      return this.toResult(client.mchId, mp.appId, raw, outBillNo);
    } catch (err) {
      this.rethrowRpc(err, '查询商家转账失败');
    }
  }

  /** 给业务侧下发调起收款页所需的固定商户参数（不含 package） */
  merchantInfo(): { mchId: string } {
    const cfg = this.requireConfig();
    return { mchId: cfg.mchId };
  }

  private requireConfig(): WechatPayMerchantConfig {
    const cfg = wechatPayMerchantConfig();
    if (!cfg) {
      rpcFail(
        503,
        '未配置微信支付商户（WECHAT_PAY_MCH_ID / SERIAL_NO / PRIVATE_KEY / TRANSFER_SCENE_ID）',
      );
    }
    if (!cfg.transferReportInfos.length) {
      rpcFail(503, 'WECHAT_TRANSFER_REPORT_INFOS 无效或为空');
    }
    return cfg;
  }

  /** 非 RpcException 的异常一律转成可读 rpcFail，避免网关只看到 Internal server error */
  private rethrowRpc(err: unknown, fallback: string): never {
    const rec = err as { status?: number; message?: string; error?: unknown };
    if (typeof rec?.status === 'number' && rec.message) {
      rpcFail(rec.status, String(rec.message));
    }
    // Nest RpcException.getError() 形态
    if (rec && typeof rec === 'object' && 'getError' in rec) {
      const payload = (
        rec as { getError: () => unknown }
      ).getError();
      if (payload && typeof payload === 'object') {
        const p = payload as { status?: number; message?: unknown };
        if (typeof p.status === 'number') {
          rpcFail(p.status, String(p.message ?? fallback));
        }
      }
      if (typeof payload === 'string') {
        rpcFail(502, payload);
      }
    }
    this.logger.error(err);
    rpcFail(
      502,
      `${fallback}：${err instanceof Error ? err.message : String(err)}`,
    );
  }

  private toResult(
    mchId: string,
    appId: string,
    raw: {
      out_bill_no?: string;
      transfer_bill_no?: string;
      create_time?: string;
      state?: string;
      package_info?: string;
      fail_reason?: string;
    },
    fallbackOutBillNo: string,
  ): MerchantTransferResult {
    return {
      mchId,
      appId,
      outBillNo: raw.out_bill_no ?? fallbackOutBillNo,
      transferBillNo: raw.transfer_bill_no ?? null,
      state: raw.state ?? 'UNKNOWN',
      packageInfo: raw.package_info ?? null,
      failReason: raw.fail_reason ?? null,
      createTime: raw.create_time ?? null,
    };
  }
}
