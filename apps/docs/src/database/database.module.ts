import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { databaseUrl } from '@app/common';
import { DOCS_ENTITIES } from '../entities';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: databaseUrl(),
      entities: DOCS_ENTITIES,
      synchronize: process.env.TYPEORM_SYNC !== 'false',
      logging: process.env.TYPEORM_LOGGING === 'true',
    }),
    TypeOrmModule.forFeature(DOCS_ENTITIES),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
