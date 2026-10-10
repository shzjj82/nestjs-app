import { Inject, Module, OnModuleInit } from '@nestjs/common';
import { ClientProxy, ClientsModule } from '@nestjs/microservices';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  mqttClientOptions,
  RECYCLE_CLIENT,
  WECHAT_CLIENT,
} from '@app/common';
import { CatalogModule } from '../catalog/catalog.module';
import { RECYCLE_ENTITIES } from '../entities';
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
    TypeOrmModule.forFeature(RECYCLE_ENTITIES),
    PolicyModule,
    CatalogModule,
    ClientsModule.register([
      {
        name: RECYCLE_CLIENT,
        ...mqttClientOptions('recycle-self-orders'),
      },
      {
        name: WECHAT_CLIENT,
        ...mqttClientOptions('recycle-to-wechat'),
      },
    ]),
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule implements OnModuleInit {
  constructor(
    @Inject(RECYCLE_CLIENT) private readonly bus: ClientProxy,
    @Inject(WECHAT_CLIENT) private readonly wechat: ClientProxy,
  ) {}

  async onModuleInit() {
    await this.bus.connect();
    await this.wechat.connect();
  }
}
