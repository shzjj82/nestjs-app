import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { VisionController } from './vision.controller';
import { VisionService } from './vision.service';

@Module({
  imports: [DatabaseModule],
  controllers: [VisionController],
  providers: [VisionService],
})
export class VisionModule {}
