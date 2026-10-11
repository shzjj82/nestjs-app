import { RecycleApprovalRecordEntity } from './recycle-approval-record.entity';
import { RecycleApprovalTaskEntity } from './recycle-approval-task.entity';
import { RecycleAuditReportEntity } from './recycle-audit-report.entity';
import { RecycleBrandEntity } from './recycle-brand.entity';
import { RecycleCartridgeTypeEntity } from './recycle-cartridge-type.entity';
import { RecycleModelEntity } from './recycle-model.entity';
import { RecycleStoreEntity } from './recycle-store.entity';
import { RecycleStoreStaffEntity } from './recycle-store-staff.entity';
import { RecycleOrderEntity } from './recycle-order.entity';
import { RecycleOrderEventEntity } from './recycle-order-event.entity';
import { RecycleOrderItemEntity } from './recycle-order-item.entity';

export * from './recycle-approval-record.entity';
export * from './recycle-approval-task.entity';
export * from './recycle-audit-report.entity';
export * from './recycle-brand.entity';
export * from './recycle-cartridge-type.entity';
export * from './recycle-model.entity';
export * from './recycle-store.entity';
export * from './recycle-store-staff.entity';
export * from './recycle-order.entity';
export * from './recycle-order-event.entity';
export * from './recycle-order-item.entity';

export const RECYCLE_ENTITIES = [
  RecycleOrderEntity,
  RecycleOrderItemEntity,
  RecycleOrderEventEntity,
  RecycleAuditReportEntity,
  RecycleApprovalTaskEntity,
  RecycleApprovalRecordEntity,
  // 目录（参考数据，只读字典）
  RecycleCartridgeTypeEntity,
  RecycleBrandEntity,
  RecycleModelEntity,
  RecycleStoreEntity,
  RecycleStoreStaffEntity,
];
