import { Module } from '@nestjs/common';
import {
  ApiDocsModule,
  MQTT_GROUPS,
  MQTT_PATTERNS,
  sharePattern,
} from '@app/common';
import { DatabaseModule } from './database/database.module';
import { MedicalController } from './medical.controller';
import { AiModule } from './modules/ai/ai.module';
import { AuthModule } from './modules/auth/auth.module';
import { CasesModule } from './modules/cases/cases.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { FilesModule } from './modules/files/files.module';
import { KnowledgeModule } from './modules/knowledge/knowledge.module';
import { PatientsModule } from './modules/patients/patients.module';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    DashboardModule,
    PatientsModule,
    CasesModule,
    KnowledgeModule,
    AiModule,
    FilesModule,
    ApiDocsModule.forService({
      service: 'medical',
      label: '中医诊所',
      pattern: sharePattern(
        MQTT_GROUPS.MEDICAL,
        MQTT_PATTERNS.MEDICAL_API_DOCS,
      ),
    }),
  ],
  controllers: [MedicalController],
})
export class MedicalModule {}
