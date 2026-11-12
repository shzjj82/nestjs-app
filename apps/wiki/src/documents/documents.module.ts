import { Module } from '@nestjs/common';
import { ClientsModule } from '@nestjs/microservices';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AGENTS_CLIENT, NOTIFY_CLIENT, mqttClientOptions } from '@app/common';
import { CategoriesModule } from '../categories/categories.module';
import { DocumentEntity } from '../entities';
import { TeamsModule } from '../teams/teams.module';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { RagNotify } from './rag-notify';
import { TeamAccess } from './team-access';
import { TodoPageCleanup } from './todo-page-cleanup';

@Module({
  imports: [
    TypeOrmModule.forFeature([DocumentEntity]),
    CategoriesModule,
    TeamsModule,
    ClientsModule.register([
      {
        name: AGENTS_CLIENT,
        ...mqttClientOptions('wiki-agents'),
      },
      {
        name: NOTIFY_CLIENT,
        ...mqttClientOptions('wiki-docs-notify'),
      },
    ]),
  ],
  controllers: [DocumentsController],
  providers: [DocumentsService, TeamAccess, RagNotify, TodoPageCleanup],
  exports: [DocumentsService, TeamAccess],
})
export class DocumentsModule {}
