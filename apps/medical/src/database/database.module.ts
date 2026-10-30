import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { medicalDatabaseUrl } from '@app/common';
import { MEDICAL_ENTITIES } from '../entities';

const sync = process.env.TYPEORM_SYNC !== 'false';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: medicalDatabaseUrl(),
      entities: MEDICAL_ENTITIES,
      synchronize: sync,
      logging: process.env.TYPEORM_LOGGING === 'true',
    }),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
