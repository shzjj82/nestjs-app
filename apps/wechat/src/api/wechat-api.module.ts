import { Module } from '@nestjs/common';
import { RedisInfraModule } from '@app/common';
import { MiniProgramsModule } from '../miniprograms/miniprograms.module';
import { WechatApiController } from './wechat-api.controller';
import { WechatApiService } from './wechat-api.service';

@Module({
  imports: [RedisInfraModule, MiniProgramsModule],
  controllers: [WechatApiController],
  providers: [WechatApiService],
  exports: [WechatApiService],
})
export class WechatApiModule {}
