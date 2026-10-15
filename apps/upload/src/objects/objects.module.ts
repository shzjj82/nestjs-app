import { Module } from '@nestjs/common';
import { ClientsModule } from '@nestjs/microservices';
import { AGENTS_CLIENT, mqttClientOptions } from '@app/common';
import { StorageModule } from '../storage/storage.module';
import { ObjectsController } from './objects.controller';
import { ObjectsService } from './objects.service';
import { RagNotify } from './rag-notify';

@Module({
  imports: [
    StorageModule,
    ClientsModule.register([
      {
        name: AGENTS_CLIENT,
        ...mqttClientOptions('upload-agents'),
      },
    ]),
  ],
  controllers: [ObjectsController],
  providers: [ObjectsService, RagNotify],
  exports: [ObjectsService],
})
export class ObjectsModule {}
