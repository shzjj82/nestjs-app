import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { agentsDatabaseUrl } from '@app/common';
import { AGENTS_ENTITIES } from '../entities';
import { InitAgentsSchema1760000003000 } from './migrations/1760000003000-init-agents-schema';
import { VisionJobs1760000003100 } from './migrations/1760000003100-vision-jobs';
import { VisionAccountId1760000003200 } from './migrations/1760000003200-vision-account-id';

const sync = process.env.TYPEORM_SYNC === 'true';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: agentsDatabaseUrl(),
      entities: AGENTS_ENTITIES,
      synchronize: sync,
      migrationsRun: !sync,
      migrations: [InitAgentsSchema1760000003000, VisionJobs1760000003100, VisionAccountId1760000003200],
      logging: process.env.TYPEORM_LOGGING === 'true',
    }),
    TypeOrmModule.forFeature(AGENTS_ENTITIES),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
