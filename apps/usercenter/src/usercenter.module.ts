import { Module } from '@nestjs/common';
import { HandleLogInterceptor } from './handle-log.interceptor';
import { UsercenterController } from './usercenter.controller';
import { UsercenterService } from './usercenter.service';

@Module({
  imports: [],
  controllers: [UsercenterController],
  providers: [UsercenterService, HandleLogInterceptor],
})
export class UsercenterModule {}
