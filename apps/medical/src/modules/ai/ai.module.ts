import { Module } from '@nestjs/common';
import { AgentsClient } from '@app/common';
import { AuthModule } from '../auth/auth.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { PatientsModule } from '../patients/patients.module';
import { AiController } from './ai.controller';
import { AiHttpController } from './ai-http.controller';
import { AiService } from './ai.service';
import { SkillsController } from './skills.controller';
import { SkillsService } from './skills.service';

@Module({
  imports: [PatientsModule, KnowledgeModule, AuthModule],
  controllers: [AiController, AiHttpController, SkillsController],
  providers: [AiService, SkillsService, AgentsClient],
  exports: [AiService, SkillsService],
})
export class AiModule {}
