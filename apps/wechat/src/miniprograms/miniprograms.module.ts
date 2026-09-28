import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MiniProgramEntity } from '../entities';
import { MiniProgramsController } from './miniprograms.controller';
import { MiniProgramsService } from './miniprograms.service';

@Module({
  imports: [TypeOrmModule.forFeature([MiniProgramEntity])],
  controllers: [MiniProgramsController],
  providers: [MiniProgramsService],
  exports: [MiniProgramsService],
})
export class MiniProgramsModule {}
