import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { databaseUrl } from '@app/common';
import { DataSource, type DataSourceOptions } from 'typeorm';
import { USERCENTER_ENTITIES } from '../entities';
import { captureLegacyPasswords, migrateLegacyAccounts } from './legacy-accounts';
import { SeedService } from './seed.service';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        type: 'postgres',
        url: databaseUrl(),
        entities: USERCENTER_ENTITIES,
        synchronize: false,
        dropSchema: process.env.TYPEORM_DROP === '1',
        logging: process.env.TYPEORM_LOGGING === 'true',
      }),
      dataSourceFactory: async (options) => {
        const ds = await new DataSource(options as DataSourceOptions).initialize();
        await captureLegacyPasswords(ds);
        if (process.env.TYPEORM_SYNC !== 'false') {
          await ds.synchronize();
        }
        await migrateLegacyAccounts(ds);
        return ds;
      },
    }),
    TypeOrmModule.forFeature(USERCENTER_ENTITIES),
  ],
  providers: [SeedService],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
