import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UploadClient } from '@app/common';
import { RecycleStoreEntity, RecycleStoreStaffEntity } from '../entities';
import { StoresController } from './stores.controller';
import { StoresService } from './stores.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([RecycleStoreEntity, RecycleStoreStaffEntity]),
  ],
  controllers: [StoresController],
  providers: [StoresService, UploadClient],
  exports: [StoresService],
})
export class StoresModule {}
