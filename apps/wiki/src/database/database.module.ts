import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { wikiDatabaseUrl } from '@app/common';
import { WIKI_ENTITIES } from '../entities';
import { WikiTeamId1760000001000 } from './migrations/1760000001000-wiki-team-id';
import { InitWikiSchema1760000000000 } from './migrations/1760000000000-init-wiki-schema';
import { WikiTeamsSchema1760000002000 } from './migrations/1760000002000-wiki-teams-schema';

const sync = process.env.TYPEORM_SYNC === 'true';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: wikiDatabaseUrl(),
      entities: WIKI_ENTITIES,
      synchronize: sync,
      migrationsRun: !sync,
      migrations: [
        InitWikiSchema1760000000000,
        WikiTeamId1760000001000,
        WikiTeamsSchema1760000002000,
      ],
      logging: process.env.TYPEORM_LOGGING === 'true',
    }),
    TypeOrmModule.forFeature(WIKI_ENTITIES),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
