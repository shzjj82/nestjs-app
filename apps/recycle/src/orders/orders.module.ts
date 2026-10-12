import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogModule } from '../catalog/catalog.module';
import {
  RecycleAuditReportEntity,
  RecycleOrderEntity,
  RecycleOrderEventEntity,
  RecycleOrderItemEntity,
} from '../entities';
import { PolicyModule } from '../policy/policy.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

/**
 * 订单上下文。
 *
 * 依赖：PolicyModule（授权）+ 自己的仓储。
 * 不依赖审批模块：需要审批时发 `recycle.evt.approval.requested`，
 * 审批结论通过 `recycle.evt.approval.decided` 回到本模块的控制器。
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      RecycleOrderEntity,
      RecycleOrderItemEntity,
      RecycleOrderEventEntity,
      RecycleAuditReportEntity,
    ]),
    PolicyModule,
    CatalogModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
