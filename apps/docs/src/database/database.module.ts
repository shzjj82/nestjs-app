import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { docsDatabaseUrl } from '@app/common';
import { DOCS_ENTITIES } from '../entities';
import { InitDocsSchema1760000000000 } from './migrations/1760000000000-init-docs-schema';

const sync = process.env.TYPEORM_SYNC === 'true';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: docsDatabaseUrl(),
      entities: DOCS_ENTITIES,
      synchronize: sync,
      migrationsRun: !sync,
      migrations: [InitDocsSchema1760000000000],
      logging: process.env.TYPEORM_LOGGING === 'true',
    }),
    TypeOrmModule.forFeature(DOCS_ENTITIES),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
