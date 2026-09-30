import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiDocsModule, MQTT_GROUPS, MQTT_PATTERNS, RedisInfraModule, sharePattern } from '@app/common';
import { WechatApiModule } from './api/wechat-api.module';
import { DatabaseModule } from './database/database.module';
import { SeedService } from './database/seed.service';
import { MiniProgramEntity } from './entities';
import { MiniProgramsModule } from './miniprograms/miniprograms.module';
import { WechatController } from './wechat.controller';

@Module({
  imports: [
    DatabaseModule,
    RedisInfraModule,
    TypeOrmModule.forFeature([MiniProgramEntity]),
    MiniProgramsModule,
    WechatApiModule,
    ApiDocsModule.forService({
      service: 'wechat',
      label: '微信模块',
      pattern: sharePattern(MQTT_GROUPS.WECHAT, MQTT_PATTERNS.WECHAT_API_DOCS),
    }),
  ],
  controllers: [WechatController],
  providers: [SeedService],
})
export class WechatModule {}
