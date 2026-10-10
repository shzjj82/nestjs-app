import { Inject, Module, OnModuleInit } from '@nestjs/common';
import { ClientProxy, ClientsModule } from '@nestjs/microservices';
import { TypeOrmModule } from '@nestjs/typeorm';
import { mqttClientOptions, RECYCLE_CLIENT } from '@app/common';
import { RECYCLE_ENTITIES } from '../entities';
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
    TypeOrmModule.forFeature(RECYCLE_ENTITIES),
    ClientsModule.register([
      {
        name: RECYCLE_CLIENT,
        ...mqttClientOptions('recycle-self-approvals'),
      },
    ]),
  ],
  controllers: [ApprovalsController],
  providers: [ApprovalsService],
  exports: [ApprovalsService],
})
export class ApprovalsModule implements OnModuleInit {
  constructor(@Inject(RECYCLE_CLIENT) private readonly bus: ClientProxy) {}

  async onModuleInit() {
    await this.bus.connect();
  }
}
