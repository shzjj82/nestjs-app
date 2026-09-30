import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { ClientInfo } from '@app/common';
import { Repository } from 'typeorm';
import type { ClientType } from '../entities';
import { BusinessEntity, ClientEntity } from '../entities';
import { optionalString, requiredString, rpcFail } from '../rpc';
import { normalizeAppCode } from './wechat-app-code';

@Injectable()
export class ClientsService {
  constructor(
    @InjectRepository(ClientEntity)
    private readonly clients: Repository<ClientEntity>,
    @InjectRepository(BusinessEntity)
    private readonly businesses: Repository<BusinessEntity>,
  ) {}

  async findByAppCode(appCode: string): Promise<ClientEntity | null> {
    return this.clients.findOne({ where: { appCode: normalizeAppCode(appCode) } });
  }

  async requireByAppCode(appCode: string): Promise<ClientEntity> {
    const client = await this.findByAppCode(appCode);
    if (!client || client.status !== 1) {
      rpcFail(404, `接入端 ${appCode} 不存在或已停用`);
    }
    return client;
  }

  /**
   * 在业务下按类型选接入端；同类型有多个时必须用 clientCode 指明。
   */
  async requireForBusiness(
    businessId: string,
    type: ClientType,
    clientCode?: string,
  ): Promise<ClientEntity> {
    if (clientCode) {
      const client = await this.requireByAppCode(clientCode);
      if (client.businessId !== businessId) {
        rpcFail(403, `接入端 ${clientCode} 不属于当前业务`);
      }
      if (client.type !== type) {
        rpcFail(400, `接入端 ${client.appCode} 不是 ${type}`);
      }
      return client;
    }
    const candidates = await this.clients.find({ where: { businessId, type, status: 1 } });
    if (!candidates.length) {
      rpcFail(404, `当前业务未配置 ${type} 接入端`);
    }
    if (candidates.length > 1) {
      rpcFail(400, `当前业务有多个 ${type} 接入端，请传 clientCode`);
    }
    return candidates[0];
  }

  async requireById(id: string): Promise<ClientEntity> {
    const client = await this.clients.findOne({ where: { id }, relations: ['business'] });
    if (!client) {
      rpcFail(404, `接入端 ${id} 不存在`);
    }
    return client;
  }

  async findAll(payload: Record<string, unknown> = {}): Promise<ClientInfo[]> {
    const businessId = optionalString(payload.businessId);
    const rows = await this.clients.find({
      where: businessId ? { businessId } : {},
      relations: ['business'],
      order: { createdAt: 'ASC' },
    });
    return rows.map((row) => this.toInfo(row));
  }

  async create(payload: Record<string, unknown>): Promise<ClientInfo> {
    const appCode = normalizeAppCode(requiredString(payload.appCode, 'appCode'));
    const name = requiredString(payload.name, 'name');
    const business = await this.requireBusiness(requiredString(payload.businessId, 'businessId'));
    const exists = await this.clients.findOne({ where: { appCode } });
    if (exists) {
      rpcFail(409, `接入端 ${appCode} 已存在`);
    }
    const type = this.parseType(payload.type);
    const saved = await this.clients.save(
      this.clients.create({
        appCode,
        name,
        type,
        businessId: business.id,
        wechatAppId: optionalString(payload.wechatAppId) ?? null,
        wechatSecret: null,
        alipayAppId: optionalString(payload.alipayAppId) ?? null,
        alipayPrivateKey: optionalString(payload.alipayPrivateKey) ?? null,
        status: 1,
      }),
    );
    saved.business = business;
    return this.toInfo(saved);
  }

  async update(payload: Record<string, unknown>): Promise<ClientInfo> {
    const client = await this.requireById(requiredString(payload.id, 'id'));
    if (payload.appCode !== undefined) {
      const appCode = normalizeAppCode(requiredString(payload.appCode, 'appCode'));
      const taken = await this.clients.findOne({ where: { appCode } });
      if (taken && taken.id !== client.id) {
        rpcFail(409, `接入端 ${appCode} 已存在`);
      }
      client.appCode = appCode;
    }
    if (payload.businessId !== undefined) {
      client.business = await this.requireBusiness(requiredString(payload.businessId, 'businessId'));
      client.businessId = client.business.id;
    }
    if (payload.name) {
      client.name = requiredString(payload.name, 'name');
    }
    if (payload.type) {
      client.type = this.parseType(payload.type);
    }
    if (payload.wechatAppId !== undefined) {
      client.wechatAppId = optionalString(payload.wechatAppId) ?? null;
    }
    if (payload.alipayAppId !== undefined) {
      client.alipayAppId = optionalString(payload.alipayAppId) ?? null;
    }
    if (payload.alipayPrivateKey !== undefined) {
      client.alipayPrivateKey = optionalString(payload.alipayPrivateKey) ?? null;
    }
    if (payload.status !== undefined) {
      client.status = Number(payload.status) === 0 ? 0 : 1;
    }
    client.updatedAt = new Date();
    return this.toInfo(await this.clients.save(client));
  }

  toInfo(client: ClientEntity): ClientInfo {
    return {
      id: client.id,
      appCode: client.appCode,
      businessId: client.businessId,
      businessCode: client.business?.code ?? null,
      name: client.name,
      type: client.type,
      wechatAppId: client.wechatAppId,
      hasWechatSecret: false,
      alipayAppId: client.alipayAppId,
      hasAlipayPrivateKey: !!client.alipayPrivateKey,
      status: client.status,
    };
  }

  private async requireBusiness(id: string): Promise<BusinessEntity> {
    const business = await this.businesses.findOne({ where: { id } });
    if (!business) {
      rpcFail(404, `业务 ${id} 不存在`);
    }
    return business;
  }

  private parseType(value: unknown): ClientType {
    if (
      value === 'wechat_mp' ||
      value === 'alipay_mp' ||
      value === 'app' ||
      value === 'web'
    ) {
      return value;
    }
    if (value === 'miniprogram') {
      return 'wechat_mp';
    }
    return 'web';
  }
}
