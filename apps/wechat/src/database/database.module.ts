import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { wechatDatabaseUrl } from '@app/common';
import { WECHAT_ENTITIES } from '../entities';
import { InitWechatSchema1760000001000 } from './migrations/1760000001000-init-wechat-schema';

const sync = process.env.TYPEORM_SYNC === 'true';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: wechatDatabaseUrl(),
      entities: WECHAT_ENTITIES,
      synchronize: sync,
      migrationsRun: !sync,
      migrations: [InitWechatSchema1760000001000],
      logging: process.env.TYPEORM_LOGGING === 'true',
    }),
    TypeOrmModule.forFeature(WECHAT_ENTITIES),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
