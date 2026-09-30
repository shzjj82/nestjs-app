import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BusinessEntity, ClientEntity } from '../entities';
import { AppsController } from './apps.controller';
import { ClientsService } from './clients.service';

@Module({
  imports: [TypeOrmModule.forFeature([ClientEntity, BusinessEntity])],
  controllers: [AppsController],
  providers: [ClientsService],
  exports: [ClientsService],
})
export class AppsModule {}
