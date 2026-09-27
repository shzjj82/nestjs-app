import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientEntity } from '../entities';
import { AppsController } from './apps.controller';
import { ClientsService } from './clients.service';

@Module({
  imports: [TypeOrmModule.forFeature([ClientEntity])],
  controllers: [AppsController],
  providers: [ClientsService],
  exports: [ClientsService],
})
export class AppsModule {}
