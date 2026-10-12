import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  RecycleBrandEntity,
  RecycleCartridgeTypeEntity,
  RecycleModelEntity,
} from '../entities';
import { seedCatalog } from './catalog-seed';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';

/**
 * 目录上下文（参考数据）。
 *
 * 单向依赖：orders → catalog（查价），catalog 不认识 orders / approvals，
 * 也不发任何事件。查询公开；增改下架由业务身份限制。
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      RecycleCartridgeTypeEntity,
      RecycleBrandEntity,
      RecycleModelEntity,
    ]),
  ],
  controllers: [CatalogController],
  providers: [CatalogService],
  exports: [CatalogService],
})
export class CatalogModule implements OnModuleInit {
  constructor(private readonly dataSource: DataSource) {}

  /** 空库时灌目录种子；已有数据不覆盖 */
  async onModuleInit() {
    await seedCatalog(this.dataSource);
  }
}
