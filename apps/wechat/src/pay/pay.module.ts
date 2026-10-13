import { Module } from '@nestjs/common';
import { MiniProgramsModule } from '../miniprograms/miniprograms.module';
import { TransferController } from './transfer.controller';
import { TransferService } from './transfer.service';

@Module({
  imports: [MiniProgramsModule],
  controllers: [TransferController],
  providers: [TransferService],
  exports: [TransferService],
})
export class PayModule {}
