import { Module } from '@nestjs/common';
import { ClientsModule } from '@nestjs/microservices';
import { mqttClientOptions, USER_CLIENT } from '@app/common';
import { DatabaseModule } from '../database/database.module';
import { EmbeddingService } from './embedding.service';
import { RagController } from './rag.controller';
import { RagPort } from './rag-port';
import { RagService } from './rag.service';

@Module({
  imports: [
    DatabaseModule,
    ClientsModule.register([
      {
        name: USER_CLIENT,
        ...mqttClientOptions('agents-user'),
      },
    ]),
  ],
  controllers: [RagController],
  providers: [
    EmbeddingService,
    RagService,
    { provide: RagPort, useExisting: RagService },
  ],
  exports: [RagService, RagPort, EmbeddingService],
})
export class RagModule {}
