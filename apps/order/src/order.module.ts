import { Inject, Module, OnModuleInit } from '@nestjs/common';
import { ClientProxy, ClientsModule } from '@nestjs/microservices';
import { mqttClientOptions, USER_CLIENT } from '@app/common';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: USER_CLIENT,
        ...mqttClientOptions('order-to-user'),
      },
    ]),
  ],
  controllers: [OrderController],
  providers: [OrderService],
})
export class OrderModule implements OnModuleInit {
  constructor(@Inject(USER_CLIENT) private readonly userClient: ClientProxy) {}

  async onModuleInit() {
    await this.userClient.connect();
  }
}
