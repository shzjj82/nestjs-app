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
import { IdentityModule } from './identity/identity.module';
import { RecycleMqttModule } from './mqtt/recycle-mqtt.module';
import { OrdersModule } from './orders/orders.module';
import { StoresModule } from './stores/stores.module';
import { PolicyModule } from './policy/policy.module';
import { RecycleController } from './recycle.controller';

/**
 * 回收微服务。
 *
 * 目录 / 门店 / 订单 / 审批按上下文拆分。
 * 订单与审批彼此不 import，只靠事件：
 *   OrdersModule  ──(evt.approval.requested)──▶ ApprovalsModule
 *   OrdersModule ◀──(evt.approval.decided)────  ApprovalsModule
 * 身份（含实时角色）和 MQTT 出站连接是全局基础设施。
 */
@Module({
  imports: [
    RecycleMqttModule,
    DatabaseModule,
    PolicyModule,
    CatalogModule,
    StoresModule,
    IdentityModule,
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
