import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { RECYCLE_ENTITIES } from '../entities';
import { seedCatalog } from './catalog-seed';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';

/**
 * 目录上下文（参考数据）。
 *
 * 单向依赖：orders → catalog（查价），catalog 不认识 orders / approvals，
 * 也不发任何事件。它是「只读字典 + 定价器」，出问题不影响下单主流程之外的东西。
 */
@Module({
  imports: [TypeOrmModule.forFeature(RECYCLE_ENTITIES)],
  controllers: [CatalogController],
  providers: [CatalogService],
  exports: [CatalogService],
})
export class CatalogModule implements OnModuleInit {
  constructor(private readonly dataSource: DataSource) {}

  /** 启动时灌目录种子；改价改完重启即生效（幂等 upsert） */
  async onModuleInit() {
    await seedCatalog(this.dataSource);
  }
}
