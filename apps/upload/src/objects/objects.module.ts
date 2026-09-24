import { Module } from '@nestjs/common';
import { SharedModule } from '../common/shared.module';
import { StorageModule } from '../storage/storage.module';
import { ObjectsController } from './objects.controller';
import { ObjectsService } from './objects.service';

@Module({
  imports: [SharedModule, StorageModule],
  controllers: [ObjectsController],
  providers: [ObjectsService],
  exports: [ObjectsService],
})
export class ObjectsModule {}
