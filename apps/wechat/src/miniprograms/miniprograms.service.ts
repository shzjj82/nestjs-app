import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { WechatMiniProgram } from '@app/common';
import { FindOptionsWhere, Repository } from 'typeorm';
import { optionalString, requiredString, rpcFail } from '../common/rpc';
import { MiniProgramEntity } from '../entities';

@Injectable()
export class MiniProgramsService {
  constructor(
    @InjectRepository(MiniProgramEntity)
    private readonly programs: Repository<MiniProgramEntity>,
  ) {}

  async findAll(): Promise<WechatMiniProgram[]> {
    const rows = await this.programs.find({ order: { createdAt: 'ASC' } });
    return rows.map((row) => this.toInfo(row));
  }

  async requireEnabled(payload: Record<string, unknown>): Promise<MiniProgramEntity> {
    const id = optionalString(payload.id);
    const code = optionalString(payload.code) ?? optionalString(payload.mpCode);
    const appId = optionalString(payload.appId);
    if (!id && !code && !appId) {
      rpcFail(400, 'id、code 或 appId 必填其一');
    }
    const where: FindOptionsWhere<MiniProgramEntity>[] = [];
    if (id) {
      where.push({ id });
    }
    if (code) {
      where.push({ code }, { appId: code });
    }
    if (appId) {
      where.push({ appId }, { code: appId });
    }
    const row = await this.programs.findOne({ where });
    if (!row || row.status !== 1) {
      rpcFail(404, '小程序未登记或已停用');
    }
    return row;
  }

  async create(payload: Record<string, unknown>): Promise<WechatMiniProgram> {
    const code = this.normalizeCode(requiredString(payload.code, 'code'));
    const name = requiredString(payload.name, 'name');
    const appId = requiredString(payload.appId, 'appId');
    const secret = requiredString(payload.secret, 'secret');
    await this.assertCodeFree(code);
    await this.assertAppIdFree(appId);
    const saved = await this.programs.save(
      this.programs.create({
        code,
        name,
        appId,
        secret,
        status: 1,
      }),
    );
    return this.toInfo(saved);
  }

  async update(payload: Record<string, unknown>): Promise<WechatMiniProgram> {
    const row = await this.programs.findOne({
      where: { id: requiredString(payload.id, 'id') },
    });
    if (!row) {
      rpcFail(404, `小程序 ${String(payload.id)} 不存在`);
    }
    if (payload.code !== undefined) {
      const code = this.normalizeCode(requiredString(payload.code, 'code'));
      const taken = await this.programs.findOne({ where: { code } });
      if (taken && taken.id !== row.id) {
        rpcFail(409, `code ${code} 已存在`);
      }
      row.code = code;
    }
    if (payload.name) {
      row.name = requiredString(payload.name, 'name');
    }
    if (payload.appId !== undefined) {
      const appId = requiredString(payload.appId, 'appId');
      const taken = await this.programs.findOne({ where: { appId } });
      if (taken && taken.id !== row.id) {
        rpcFail(409, `appId ${appId} 已存在`);
      }
      row.appId = appId;
    }
    if (payload.secret !== undefined) {
      const secret = optionalString(payload.secret);
      if (secret) {
        row.secret = secret;
      }
    }
    if (payload.status !== undefined) {
      row.status = Number(payload.status) === 0 ? 0 : 1;
    }
    row.updatedAt = new Date();
    return this.toInfo(await this.programs.save(row));
  }

  toInfo(row: MiniProgramEntity): WechatMiniProgram {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      appId: row.appId,
      hasSecret: !!row.secret,
      status: row.status,
    };
  }

  private async assertCodeFree(code: string) {
    if (await this.programs.findOne({ where: { code } })) {
      rpcFail(409, `code ${code} 已存在`);
    }
  }

  private async assertAppIdFree(appId: string) {
    if (await this.programs.findOne({ where: { appId } })) {
      rpcFail(409, `appId ${appId} 已存在`);
    }
  }

  private normalizeCode(code: string): string {
    if (!/^[a-zA-Z][a-zA-Z0-9_-]{1,31}$/.test(code)) {
      rpcFail(400, 'code 需为 2-32 位，字母开头，仅含字母数字和 _-');
    }
    return code;
  }
}
