import { CaseDiagnosis, CaseExam, CaseHistory } from './case-clinical.entity';
import { CaseRecord } from './case-record.entity';
import { ExternalReference } from './external-reference.entity';
import { InternalProtocol } from './internal-protocol.entity';
import { PatientContact } from './patient-contact.entity';
import { Patient } from './patient.entity';
import { User } from './user.entity';
import { Visit } from './visit.entity';

export * from './case-clinical.entity';
export * from './case-record.entity';
export * from './external-reference.entity';
export * from './internal-protocol.entity';
export * from './patient-contact.entity';
export * from './patient.entity';
export * from './user.entity';
export * from './visit.entity';

export const MEDICAL_ENTITIES = [
  User,
  Patient,
  PatientContact,
  Visit,
  CaseRecord,
  CaseHistory,
  CaseDiagnosis,
  CaseExam,
  InternalProtocol,
  ExternalReference,
];
