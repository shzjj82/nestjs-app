import { Module } from '@nestjs/common';
import { OrderPolicyService } from './policy.service';

/**
 * 策略模块：无数据库依赖，只导出策略引擎。
 * 订单上下文依赖它，审批上下文不依赖它（审批只负责决策，不关心状态机）。
 */
@Module({
  providers: [OrderPolicyService],
  exports: [OrderPolicyService],
})
export class PolicyModule {}
