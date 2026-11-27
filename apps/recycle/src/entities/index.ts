import { RecycleApprovalRecordEntity } from '../modules/approvals/entity/recycle-approval-record.entity';
import { RecycleApprovalTaskEntity } from '../modules/approvals/entity/recycle-approval-task.entity';
import { RecycleBrandEntity } from '../modules/catalog/entity/recycle-brand.entity';
import { RecycleCartridgeTypeEntity } from '../modules/catalog/entity/recycle-cartridge-type.entity';
import { RecycleModelEntity } from '../modules/catalog/entity/recycle-model.entity';
import { RecycleAuditReportEntity } from '../modules/orders/entity/recycle-audit-report.entity';
import { RecycleOrderEventEntity } from '../modules/orders/entity/recycle-order-event.entity';
import { RecycleOrderItemEntity } from '../modules/orders/entity/recycle-order-item.entity';
import { RecycleOrderEntity } from '../modules/orders/entity/recycle-order.entity';
import { RecycleStoreStaffEntity } from '../modules/stores/entity/recycle-store-staff.entity';
import { RecycleStoreEntity } from '../modules/stores/entity/recycle-store.entity';

export * from '../modules/approvals/entity/recycle-approval-record.entity';
export * from '../modules/approvals/entity/recycle-approval-task.entity';
export * from '../modules/orders/entity/recycle-audit-report.entity';
export * from '../modules/catalog/entity/recycle-brand.entity';
export * from '../modules/catalog/entity/recycle-cartridge-type.entity';
export * from '../modules/catalog/entity/recycle-model.entity';
export * from '../modules/stores/entity/recycle-store.entity';
export * from '../modules/stores/entity/recycle-store-staff.entity';
export * from '../modules/orders/entity/recycle-order.entity';
export * from '../modules/orders/entity/recycle-order-event.entity';
export * from '../modules/orders/entity/recycle-order-item.entity';

export const RECYCLE_ENTITIES = [
  RecycleOrderEntity,
  RecycleOrderItemEntity,
  RecycleOrderEventEntity,
  RecycleAuditReportEntity,
  RecycleApprovalTaskEntity,
  RecycleApprovalRecordEntity,
  RecycleCartridgeTypeEntity,
  RecycleBrandEntity,
  RecycleModelEntity,
  RecycleStoreEntity,
  RecycleStoreStaffEntity,
];
