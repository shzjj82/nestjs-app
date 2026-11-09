import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccessClientsModule } from '../clients/clients.module';
import { BusinessesModule } from '../businesses/businesses.module';
import { AccountEntity, TeamEntity, TeamMemberEntity } from '../entities';
import { TeamsController } from './teams.controller';
import { TeamsService } from './teams.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([TeamEntity, TeamMemberEntity, AccountEntity]),
    AccessClientsModule,
    BusinessesModule,
  ],
  controllers: [TeamsController],
  providers: [TeamsService],
  exports: [TeamsService],
})
export class TeamsModule {}
