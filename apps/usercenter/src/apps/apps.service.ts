import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { AppInfo } from '@app/common';
import { Repository } from 'typeorm';
import { AppEntity } from '../entities';
import { optionalString, requiredString, rpcFail } from '../rpc';

@Injectable()
export class AppsService {
  constructor(
    @InjectRepository(AppEntity)
    private readonly apps: Repository<AppEntity>,
  ) {}

  async requireByAppId(appId: string): Promise<AppEntity> {
    const app = await this.apps.findOne({ where: { appId } });
    if (!app || app.status !== 1) {
      rpcFail(404, `应用 ${appId} 不存在或已停用`);
    }
    return app;
  }

  async requireById(id: string): Promise<AppEntity> {
    const app = await this.apps.findOne({ where: { id } });
    if (!app) {
      rpcFail(404, `应用 ${id} 不存在`);
    }
    return app;
  }

  async findAll(): Promise<AppInfo[]> {
    const rows = await this.apps.find({ order: { createdAt: 'ASC' } });
    return rows.map((row) => this.toInfo(row));
  }

  async create(payload: Record<string, unknown>): Promise<AppInfo> {
    const appId = requiredString(payload.appId, 'appId');
    const name = requiredString(payload.name, 'name');
    const exists = await this.apps.findOne({ where: { appId } });
    if (exists) {
      rpcFail(409, `应用 ${appId} 已存在`);
    }
    const type = this.parseType(payload.type);
    const saved = await this.apps.save(
      this.apps.create({
        appId,
        name,
        type,
        wechatAppId: optionalString(payload.wechatAppId) ?? null,
        wechatSecret: optionalString(payload.wechatSecret) ?? null,
        status: 1,
      }),
    );
    return this.toInfo(saved);
  }

  async update(payload: Record<string, unknown>): Promise<AppInfo> {
    const app = await this.requireById(requiredString(payload.id, 'id'));
    if (payload.name) {
      app.name = requiredString(payload.name, 'name');
    }
    if (payload.type) {
      app.type = this.parseType(payload.type);
    }
    if (payload.wechatAppId !== undefined) {
      app.wechatAppId = optionalString(payload.wechatAppId) ?? null;
    }
    if (payload.wechatSecret !== undefined) {
      app.wechatSecret = optionalString(payload.wechatSecret) ?? null;
    }
    if (payload.status !== undefined) {
      app.status = Number(payload.status) === 0 ? 0 : 1;
    }
    app.updatedAt = new Date();
    return this.toInfo(await this.apps.save(app));
  }

  toInfo(app: AppEntity): AppInfo {
    return {
      id: app.id,
      appId: app.appId,
      name: app.name,
      type: app.type,
      wechatAppId: app.wechatAppId,
      status: app.status,
    };
  }

  private parseType(value: unknown): AppEntity['type'] {
    if (value === 'miniprogram' || value === 'app' || value === 'web') {
      return value;
    }
    return 'web';
  }
}
