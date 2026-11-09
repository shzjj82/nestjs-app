import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BusinessEntity, ClientEntity } from '../entities';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';

@Module({
  imports: [TypeOrmModule.forFeature([ClientEntity, BusinessEntity])],
  controllers: [ClientsController],
  providers: [ClientsService],
  exports: [ClientsService],
})
/** 接入端模块；不用 ClientsModule 作类名，避免和 @nestjs/microservices 撞名 */
export class AccessClientsModule {}
