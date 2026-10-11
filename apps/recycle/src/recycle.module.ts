import { Module } from '@nestjs/common';
import {
  ApiDocsModule,
  MQTT_GROUPS,
  MQTT_PATTERNS,
  sharePattern,
} from '@app/common';
import { ApprovalsModule } from './approvals/approvals.module';
import { CatalogModule } from './catalog/catalog.module';
import { DatabaseModule } from './database/database.module';
import { OrdersModule } from './orders/orders.module';
import { StoresModule } from './stores/stores.module';
import { PolicyModule } from './policy/policy.module';
import { RecycleController } from './recycle.controller';

/**
 * 回收微服务。
 *
 * 两个限界上下文彼此不认识：
 *   OrdersModule  ──(evt.approval.requested)──▶ ApprovalsModule
 *   OrdersModule ◀──(evt.approval.decided)────  ApprovalsModule
 * 公共部分只有 domain（纯类型）和 entities（表结构），没有服务级耦合。
 */
@Module({
  imports: [
    DatabaseModule,
    PolicyModule,
    CatalogModule,
    StoresModule,
    OrdersModule,
    ApprovalsModule,
    ApiDocsModule.forService({
      service: 'recycle',
      label: '回收模块',
      pattern: sharePattern(
        MQTT_GROUPS.RECYCLE,
        MQTT_PATTERNS.RECYCLE_API_DOCS,
      ),
    }),
  ],
  controllers: [RecycleController],
})
export class RecycleModule {}
