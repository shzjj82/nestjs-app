import { Module } from '@nestjs/common';
import { ClientsModule } from '@nestjs/microservices';
import { TypeOrmModule } from '@nestjs/typeorm';
import { mqttClientOptions, RedisInfraModule, USER_CLIENT } from '@app/common';
import { DocumentEntity } from '../entities/document.entity';
import { TeamEntity } from '../entities/team.entity';
import { TeamMemberEntity } from '../entities/team-member.entity';
import { TeamsController } from './teams.controller';
import { TeamsService } from './teams.service';

@Module({
  imports: [
    RedisInfraModule,
    TypeOrmModule.forFeature([TeamEntity, TeamMemberEntity, DocumentEntity]),
    ClientsModule.register([
      {
        name: USER_CLIENT,
        ...mqttClientOptions('wiki-teams-user'),
      },
    ]),
  ],
  controllers: [TeamsController],
  providers: [TeamsService],
  exports: [TeamsService],
})
export class TeamsModule {}
