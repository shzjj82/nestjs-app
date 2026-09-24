import { Injectable } from '@nestjs/common';
import {
  aboutFromPost,
  propsWithAboutExtras,
  type SiteAbout,
} from '../common/shared';
import { DocumentsService } from '../documents/documents.service';

/**
 * 首页关于卡不是独立存储。
 * 唯一数据源是 kind=about 的文档；这里只做投影读写。
 */
@Injectable()
export class SiteService {
  constructor(private readonly posts: DocumentsService) {}

  async getAbout(appCode: string): Promise<SiteAbout> {
    const page = await this.posts.ensureAboutPage(appCode);
    return aboutFromPost(page);
  }

  async saveAbout(appCode: string, input: SiteAbout): Promise<SiteAbout> {
    const page = await this.posts.ensureAboutPage(appCode);
    const updated = await this.posts.update(page.id, {
      appCode: page.appCode,
      title: input.name,
      type: page.type,
      pageKind: 'about',
      summary: page.summary,
      coverUrl: page.coverUrl,
      props: propsWithAboutExtras(page.props, {
        avatar: input.avatar,
        skills: input.skills,
      }),
      body: input.body,
      draft: false,
    });
    return aboutFromPost(updated ?? page);
  }
}
