import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MiniProgramEntity } from '../entities';

@Injectable()
export class SeedService implements OnModuleInit {
  private readonly logger = new Logger('WechatSeed');

  constructor(
    @InjectRepository(MiniProgramEntity)
    private readonly programs: Repository<MiniProgramEntity>,
  ) {}

  async onModuleInit() {
    const appId = process.env.WECHAT_APP_ID ?? '';
    const secret = process.env.WECHAT_SECRET ?? '';
    if (!appId || !secret) {
      this.logger.log('未配置 WECHAT_APP_ID，跳过默认小程序种子');
      return;
    }
    const code = process.env.WECHAT_MP_CODE ?? 'wechat';
    const exists =
      (await this.programs.findOne({ where: { code } })) ??
      (await this.programs.findOne({ where: { appId } }));
    if (exists) {
      return;
    }
    await this.programs.save(
      this.programs.create({
        code,
        name: process.env.WECHAT_MP_NAME ?? '默认微信小程序',
        appId,
        secret,
        status: 1,
      }),
    );
    this.logger.log(`已登记默认小程序 code=${code} appId=${appId}`);
  }
}
