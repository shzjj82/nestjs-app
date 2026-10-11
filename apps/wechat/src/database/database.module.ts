import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { wechatDatabaseUrl } from '@app/common';
import { WECHAT_ENTITIES } from '../entities';
import { InitWechatSchema1760000001000 } from './migrations/1760000001000-init-wechat-schema';
import { SubscribeTemplates1760000002000 } from './migrations/1760000002000-subscribe-templates';
import { MiniProgramIdDefault1760000003000 } from './migrations/1760000003000-miniprogram-id-default';

const sync = process.env.TYPEORM_SYNC === 'true';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: wechatDatabaseUrl(),
      entities: WECHAT_ENTITIES,
      synchronize: sync,
      migrationsRun: !sync,
      migrations: [
        InitWechatSchema1760000001000,
        SubscribeTemplates1760000002000,
        MiniProgramIdDefault1760000003000,
      ],
      logging: process.env.TYPEORM_LOGGING === 'true',
    }),
    TypeOrmModule.forFeature(WECHAT_ENTITIES),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
