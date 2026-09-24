import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SharedModule } from '../common/shared.module';
import { PostEntity, SiteEntity } from '../entities';
import { SiteController } from './site.controller';
import { SiteService } from './site.service';

@Module({
  imports: [TypeOrmModule.forFeature([PostEntity, SiteEntity]), SharedModule],
  controllers: [SiteController],
  providers: [SiteService],
  exports: [SiteService],
})
export class SiteModule {}
