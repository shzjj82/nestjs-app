import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  LOGIN_QR_PAGE,
  LOGIN_QR_TTL_SECONDS,
  loginQrEventsPath,
  loginQrMqttTopic,
  loginQrRedisKey,
  newLoginQrScene,
  isLoginQrScene,
  publishMqttJson,
  qrImageFilename,
  REDIS,
  sniffImageMime,
  UploadClient,
  type AuthResult,
  type LoginQrCreateResult,
  type LoginQrEvent,
  type LoginQrStatus,
  type LoginQrStatusResult,
} from '@app/common';
import type Redis from 'ioredis';
import { ClientsService } from '../apps/clients.service';
import { BusinessesService } from '../businesses/businesses.service';
import { optionalString, requiredString, rpcFail } from '../rpc';
import { AuthService } from './auth.service';
import { WechatClient } from './wechat.client';

interface LoginQrRecord {
  purpose: 'login';
  ticket: string;
  scene: string;
  status: LoginQrStatus;
  bizCode: string;
  appCode: string;
  wechatAppId: string;
  createdAt: string;
  expiresAt: string;
  auth?: AuthResult;
}

@Injectable()
export class LoginQrService {
  private readonly logger = new Logger(LoginQrService.name);

  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    private readonly businesses: BusinessesService,
    private readonly clients: ClientsService,
    private readonly wechat: WechatClient,
    private readonly upload: UploadClient,
    private readonly auth: AuthService,
  ) {}

  async create(payload: Record<string, unknown>): Promise<LoginQrCreateResult> {
    const bizCode = requiredString(payload._bizCode, 'X-Biz-Code');
    const business = await this.businesses.requireActiveByCode(bizCode);
    const client = await this.clients.requireForBusiness(
      business.id,
      'wechat_mp',
      optionalString(payload.clientCode) ?? optionalString(payload.appCode),
    );
    if (!client.wechatAppId) {
      rpcFail(400, `接入端 ${client.appCode} 未配置 wechatAppId`);
    }

    const ticket = newLoginQrScene();
    const now = Date.now();
    const expiresAt = new Date(now + LOGIN_QR_TTL_SECONDS * 1000).toISOString();
    const record: LoginQrRecord = {
      purpose: 'login',
      ticket,
      scene: ticket,
      status: 'pending',
      bizCode: business.code,
      appCode: client.appCode,
      wechatAppId: client.wechatAppId,
      createdAt: new Date(now).toISOString(),
      expiresAt,
    };
    await this.save(record);

    const page = optionalString(payload.page) ?? LOGIN_QR_PAGE;
    const file = await this.wechat.qrcode({
      appId: client.wechatAppId,
      scene: ticket,
      page,
      envVersion: optionalString(payload.envVersion) ?? 'release',
      width: Number(payload.width) > 0 ? Number(payload.width) : 280,
      // 不传则走 wechat 服务的 WECHAT_QRCODE_CHECK_PATH（默认 false）
      checkPath: parseOptionalCheckPath(payload.checkPath),
    });
    const mime = sniffImageMime(file.base64, file.mime);
    const filename = qrImageFilename(
      `login-qr-${ticket}`,
      mime,
      file.filename,
    );
    const stored = await this.upload.put({
      bizCode: business.code,
      filename,
      contentType: mime,
      base64: file.base64,
      prefix: 'login-qr',
    });

    await this.publish(record);

    return {
      purpose: 'login',
      ticket,
      scene: ticket,
      mqttTopic: loginQrMqttTopic(ticket),
      eventsPath: loginQrEventsPath(ticket),
      expiresIn: LOGIN_QR_TTL_SECONDS,
      expiresAt,
      image: {
        mime,
        filename,
        url: stored.url,
        key: stored.key,
      },
    };
  }

  async scan(payload: Record<string, unknown>): Promise<LoginQrStatusResult> {
    const record = await this.requireTicket(
      requiredString(payload.scene ?? payload.ticket, 'scene'),
    );
    if (record.status === 'pending') {
      record.status = 'scanned';
      await this.save(record);
      await this.publish(record);
    }
    return this.toStatus(record);
  }

  async confirm(payload: Record<string, unknown>): Promise<LoginQrStatusResult> {
    const record = await this.requireTicket(
      requiredString(payload.scene ?? payload.ticket, 'scene'),
    );
    if (record.status === 'confirmed' && record.auth) {
      return this.toStatus(record);
    }
    const auth = await this.auth.loginByWechat({
      ...payload,
      _bizCode: record.bizCode,
      clientCode: record.appCode,
      code: requiredString(payload.code, 'code'),
    });
    record.status = 'confirmed';
    record.auth = auth;
    await this.save(record);
    await this.publish(record);
    return this.toStatus(record);
  }

  async status(payload: Record<string, unknown>): Promise<LoginQrStatusResult> {
    const record = await this.requireTicket(
      requiredString(payload.ticket ?? payload.scene, 'ticket'),
    );
    return this.toStatus(record);
  }

  private async requireTicket(scene: string): Promise<LoginQrRecord> {
    if (!isLoginQrScene(scene)) {
      rpcFail(400, '不是登录二维码');
    }
    const raw = await this.redis.get(loginQrRedisKey(scene));
    if (!raw) {
      rpcFail(410, '登录码已过期，请刷新');
    }
    const record = JSON.parse(raw) as LoginQrRecord;
    if (new Date(record.expiresAt).getTime() <= Date.now()) {
      record.status = 'expired';
      await this.publish(record);
      await this.redis.del(loginQrRedisKey(scene));
      rpcFail(410, '登录码已过期，请刷新');
    }
    return record;
  }

  private async save(record: LoginQrRecord) {
    const ttl = Math.max(
      1,
      Math.ceil((new Date(record.expiresAt).getTime() - Date.now()) / 1000),
    );
    await this.redis.set(
      loginQrRedisKey(record.ticket),
      JSON.stringify(record),
      'EX',
      ttl,
    );
  }

  private async publish(record: LoginQrRecord) {
    const event: LoginQrEvent = {
      purpose: 'login',
      ticket: record.ticket,
      status: record.status,
      at: new Date().toISOString(),
      auth: record.status === 'confirmed' ? record.auth : undefined,
    };
    try {
      await publishMqttJson(loginQrMqttTopic(record.ticket), event);
    } catch (err) {
      this.logger.warn(
        `登录码 MQTT 推送失败 ticket=${record.ticket}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  private toStatus(record: LoginQrRecord): LoginQrStatusResult {
    return {
      purpose: 'login',
      ticket: record.ticket,
      status: record.status,
      mqttTopic: loginQrMqttTopic(record.ticket),
      expiresAt: record.expiresAt,
      auth: record.status === 'confirmed' ? record.auth : undefined,
    };
  }
}

function parseOptionalCheckPath(raw: unknown): boolean | undefined {
  if (raw === true || raw === 'true' || raw === '1') {
    return true;
  }
  if (raw === false || raw === 'false' || raw === '0') {
    return false;
  }
  return undefined;
}
