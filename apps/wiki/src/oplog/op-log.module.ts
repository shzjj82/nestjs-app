import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WikiOpEventEntity } from '../entities';
import { OpLogController } from './op-log.controller';
import { OpLogService } from './op-log.service';

@Module({
  imports: [TypeOrmModule.forFeature([WikiOpEventEntity])],
  controllers: [OpLogController],
  providers: [OpLogService],
  exports: [OpLogService],
})
export class OpLogModule {}
