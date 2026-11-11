import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { notifyDatabaseUrl } from '@app/common';
import { NOTIFY_ENTITIES } from '../entities';
import { InitNotifySchema1760900000000 } from './migrations/1760900000000-init-notify-schema';
import { SplitNoticeAndTodo1760900001000 } from './migrations/1760900001000-split-notice-and-todo';
import { TodoRemindedOn1760900002000 } from './migrations/1760900002000-todo-reminded-on';
import { TodoFourStates1760900003000 } from './migrations/1760900003000-todo-four-states';

const sync = process.env.TYPEORM_SYNC === 'true';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: notifyDatabaseUrl(),
      entities: NOTIFY_ENTITIES,
      synchronize: sync,
      migrationsRun: !sync,
      migrations: [
        InitNotifySchema1760900000000,
        SplitNoticeAndTodo1760900001000,
        TodoRemindedOn1760900002000,
        TodoFourStates1760900003000,
      ],
      logging: process.env.TYPEORM_LOGGING === 'true',
    }),
    TypeOrmModule.forFeature(NOTIFY_ENTITIES),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
