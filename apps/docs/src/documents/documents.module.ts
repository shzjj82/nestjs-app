import { Module } from '@nestjs/common';
import { ClientsModule } from '@nestjs/microservices';
import { TypeOrmModule } from '@nestjs/typeorm';
import { mqttClientOptions, USER_CLIENT } from '@app/common';
import { CategoriesModule } from '../categories/categories.module';
import { DocumentEntity } from '../entities';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
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
    ]),
  ],
  controllers: [DocumentsController],
  providers: [DocumentsService, TeamAccess],
  exports: [DocumentsService],
})
export class DocumentsModule {}
