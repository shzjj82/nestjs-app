import { Module } from '@nestjs/common';
import { ClientsModule } from '@nestjs/microservices';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AGENTS_CLIENT, mqttClientOptions, USER_CLIENT } from '@app/common';
import { CategoriesModule } from '../categories/categories.module';
import { DocumentEntity } from '../entities';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { RagNotify } from './rag-notify';
import { TeamAccess } from './team-access';

@Module({
  imports: [
    TypeOrmModule.forFeature([DocumentEntity]),
    CategoriesModule,
    ClientsModule.register([
      {
        name: USER_CLIENT,
        ...mqttClientOptions('docs-user'),
      },
      {
        name: AGENTS_CLIENT,
        ...mqttClientOptions('docs-agents'),
      },
    ]),
  ],
  controllers: [DocumentsController],
  providers: [DocumentsService, TeamAccess, RagNotify],
  exports: [DocumentsService],
})
export class DocumentsModule {}
