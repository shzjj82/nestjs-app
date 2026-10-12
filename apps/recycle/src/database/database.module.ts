import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { recycleDatabaseUrl } from '@app/common';
import { RECYCLE_ENTITIES } from '../entities';
import { CatalogIds1760500000000 } from './migrations/1760500000000-catalog-ids';
import { Stores1760600000000 } from './migrations/1760600000000-stores';
import { CreatedUpdatedAt1760700000000 } from './migrations/1760700000000-created-updated-at';
import { StoreStaffAlias1760800000000 } from './migrations/1760800000000-store-staff-alias';
import { OrderWechatAppId1760400000000 } from './migrations/1760400000000-order-wechat-appid';
import { CatalogSchema1760300000000 } from './migrations/1760300000000-catalog-schema';
import { InitRecycleSchema1760200000000 } from './migrations/1760200000000-init-recycle-schema';

const sync = process.env.TYPEORM_SYNC === 'true';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: recycleDatabaseUrl(),
      entities: RECYCLE_ENTITIES,
      synchronize: sync,
      migrationsRun: !sync,
      migrations: [
        InitRecycleSchema1760200000000,
        CatalogSchema1760300000000,
        OrderWechatAppId1760400000000,
        CatalogIds1760500000000,
        Stores1760600000000,
        CreatedUpdatedAt1760700000000,
        StoreStaffAlias1760800000000,
      ],
      logging: process.env.TYPEORM_LOGGING === 'true',
    }),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
