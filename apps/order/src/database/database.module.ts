import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { orderDatabaseUrl } from '@app/common';
import { ORDER_ENTITIES } from '../entities';
import { InitOrderSchema1760000002000 } from './migrations/1760000002000-init-order-schema';
import { OrdersNotShares1760000002100 } from './migrations/1760000002100-orders-not-shares';
import { OrderAccountId1760000002200 } from './migrations/1760000002200-order-account-id';

const sync = process.env.TYPEORM_SYNC === 'true';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: orderDatabaseUrl(),
      entities: ORDER_ENTITIES,
      synchronize: sync,
      migrationsRun: !sync,
      migrations: [InitOrderSchema1760000002000, OrdersNotShares1760000002100, OrderAccountId1760000002200],
      logging: process.env.TYPEORM_LOGGING === 'true',
    }),
    TypeOrmModule.forFeature(ORDER_ENTITIES),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
