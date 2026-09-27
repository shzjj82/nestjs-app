import { Injectable } from '@nestjs/common';
import { DEFAULT_ABOUT, type SiteAbout } from '../common/shared';

/**
 * 关于卡改为静态品牌文案，不再读写 about 文档。
 */
@Injectable()
export class SiteService {
  async getAbout(_appCode: string): Promise<SiteAbout> {
    return DEFAULT_ABOUT;
  }

  async saveAbout(_appCode: string, input: SiteAbout): Promise<SiteAbout> {
    return input;
  }
}
