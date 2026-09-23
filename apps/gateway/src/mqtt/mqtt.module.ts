import { Inject, Module, OnModuleInit } from '@nestjs/common';
import { ClientProxy, ClientsModule } from '@nestjs/microservices';
import {
  mqttClientOptions,
  ORDER_CLIENT,
  USER_CLIENT,
} from '@app/common';
import { ClientHub } from './client.hub';
import { MqttProxy } from './mqtt.proxy';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: USER_CLIENT,
        ...mqttClientOptions('gateway-user'),
      },
      {
        name: ORDER_CLIENT,
        ...mqttClientOptions('gateway-order'),
      },
    ]),
  ],
  providers: [MqttProxy, ClientHub],
  exports: [ClientsModule, MqttProxy, ClientHub],
})
export class MqttModule implements OnModuleInit {
  constructor(
    @Inject(USER_CLIENT) private readonly userClient: ClientProxy,
    @Inject(ORDER_CLIENT) private readonly orderClient: ClientProxy,
  ) {}

  async onModuleInit() {
    await Promise.all([this.userClient.connect(), this.orderClient.connect()]);
  }
}
