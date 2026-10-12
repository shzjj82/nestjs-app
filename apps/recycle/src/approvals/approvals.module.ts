import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  RecycleApprovalRecordEntity,
  RecycleApprovalTaskEntity,
} from '../entities';
import { ApprovalsController } from './approvals.controller';
import { ApprovalsService } from './approvals.service';

/**
 * 审批上下文。
 *
 * 刻意不依赖订单模块与策略模块：审批只产出「结论」，
 * 由订单侧订阅 `recycle.evt.approval.decided` 自行推进状态机。
 * 这样将来加会签、二级审批、外部审批系统都不用动订单侧。
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      RecycleApprovalTaskEntity,
      RecycleApprovalRecordEntity,
    ]),
  ],
  controllers: [ApprovalsController],
  providers: [ApprovalsService],
  exports: [ApprovalsService],
})
export class ApprovalsModule {}
