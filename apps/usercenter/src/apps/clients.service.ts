import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { ClientInfo } from '@app/common';
import { Repository } from 'typeorm';
import type { ClientType } from '../entities';
import { ClientEntity } from '../entities';
import { optionalString, requiredString, rpcFail } from '../rpc';
import { normalizeAppCode } from './wechat-app-code';

@Injectable()
export class ClientsService {
  constructor(
    @InjectRepository(ClientEntity)
    private readonly clients: Repository<ClientEntity>,
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

  async requireById(id: string): Promise<ClientEntity> {
    const client = await this.clients.findOne({ where: { id } });
    if (!client) {
      rpcFail(404, `接入端 ${id} 不存在`);
    }
    return client;
  }

  async findAll(): Promise<ClientInfo[]> {
    const rows = await this.clients.find({ order: { createdAt: 'ASC' } });
    return rows.map((row) => this.toInfo(row));
  }

  async create(payload: Record<string, unknown>): Promise<ClientInfo> {
    const appCode = normalizeAppCode(requiredString(payload.appCode, 'appCode'));
    const name = requiredString(payload.name, 'name');
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
        wechatAppId: optionalString(payload.wechatAppId) ?? null,
        wechatSecret: optionalString(payload.wechatSecret) ?? null,
        alipayAppId: optionalString(payload.alipayAppId) ?? null,
        alipayPrivateKey: optionalString(payload.alipayPrivateKey) ?? null,
        status: 1,
      }),
    );
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
    if (payload.name) {
      client.name = requiredString(payload.name, 'name');
    }
    if (payload.type) {
      client.type = this.parseType(payload.type);
    }
    if (payload.wechatAppId !== undefined) {
      client.wechatAppId = optionalString(payload.wechatAppId) ?? null;
    }
    if (payload.wechatSecret !== undefined) {
      client.wechatSecret = optionalString(payload.wechatSecret) ?? null;
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
      name: client.name,
      type: client.type,
      wechatAppId: client.wechatAppId,
      hasWechatSecret: !!client.wechatSecret,
      alipayAppId: client.alipayAppId,
      hasAlipayPrivateKey: !!client.alipayPrivateKey,
      status: client.status,
    };
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
