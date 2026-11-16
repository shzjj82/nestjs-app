import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WikiShareEntity } from '../entities/wiki-share.entity';
import { DocumentsModule } from '../documents/documents.module';
import { SharesController } from './shares.controller';
import { SharesService } from './shares.service';

@Module({
  imports: [TypeOrmModule.forFeature([WikiShareEntity]), DocumentsModule],
  controllers: [SharesController],
  providers: [SharesService],
})
export class SharesModule {}
