import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { databaseUrl } from '@app/common';
import { USERCENTER_ENTITIES } from '../entities';
import { SeedService } from './seed.service';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: databaseUrl(),
      entities: USERCENTER_ENTITIES,
      synchronize: process.env.TYPEORM_SYNC !== 'false',
      dropSchema: process.env.TYPEORM_DROP === '1',
      logging: process.env.TYPEORM_LOGGING === 'true',
    }),
    TypeOrmModule.forFeature(USERCENTER_ENTITIES),
  ],
  providers: [SeedService],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
