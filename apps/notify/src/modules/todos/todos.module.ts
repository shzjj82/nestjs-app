import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { NoticesModule } from '../notices/notices.module';
import { TodoReminder } from './todo-reminder';
import { TodosController } from './todos.controller';
import { TodosService } from './todos.service';

@Module({
  imports: [DatabaseModule, NoticesModule],
  controllers: [TodosController],
  providers: [TodosService, TodoReminder],
  exports: [TodosService],
})
export class TodosModule {}
