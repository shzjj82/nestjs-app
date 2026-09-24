import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { CategoriesService } from '../categories/categories.service';
import { PostsService } from '../posts/posts.service';
import { SiteService } from '../site/site.service';

@Injectable()
export class SeedService implements OnModuleInit {
  private readonly logger = new Logger('DocsSeed');

  constructor(
    private readonly categories: CategoriesService,
    private readonly site: SiteService,
    private readonly posts: PostsService,
  ) {}

  async onModuleInit() {
    await this.categories.ensureDefaults();
    await this.site.ensureRow();
    await this.posts.ensureAboutPage();
    this.logger.log('文档服务已就绪：默认分类与 about 页');
  }
}
