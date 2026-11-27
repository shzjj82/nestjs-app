import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WikiShareEntity } from './entity/wiki-share.entity';
import { WikiShareFavoriteEntity } from './entity/wiki-share-favorite.entity';
import { DocumentsModule } from '../documents/documents.module';
import { SharesController } from './shares.controller';
import { SharesService } from './shares.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([WikiShareEntity, WikiShareFavoriteEntity]),
    DocumentsModule,
  ],
  controllers: [SharesController],
  providers: [SharesService],
})
export class SharesModule {}
