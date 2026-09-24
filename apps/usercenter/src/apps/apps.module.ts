import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SharedModule } from '../common/shared.module';
import { ClientEntity } from '../entities';
import { AppsController } from './apps.controller';
import { ClientsService } from './clients.service';

@Module({
  imports: [TypeOrmModule.forFeature([ClientEntity]), SharedModule],
  controllers: [AppsController],
  providers: [ClientsService],
  exports: [ClientsService],
})
export class AppsModule {}
