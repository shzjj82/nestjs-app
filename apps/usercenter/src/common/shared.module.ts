import { Module } from '@nestjs/common';
import { HandleLogInterceptor } from '../handle-log.interceptor';

@Module({
  providers: [HandleLogInterceptor],
  exports: [HandleLogInterceptor],
})
export class SharedModule {}
