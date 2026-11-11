import { Module } from '@nestjs/common';
import { ClientsModule } from '@nestjs/microservices';
import { NOTIFY_CLIENT, mqttClientOptions } from '@app/common';
import { DocumentsModule } from '../documents/documents.module';
import { TodosController } from './todos.controller';
import { TodosService } from './todos.service';

@Module({
  imports: [
    DocumentsModule,
    ClientsModule.register([
      { name: NOTIFY_CLIENT, ...mqttClientOptions('wiki-todos-notify') },
    ]),
  ],
  controllers: [TodosController],
  providers: [TodosService],
})
export class TodosModule {}
