import { Inject, Module, OnModuleInit } from '@nestjs/common';
import { ClientProxy, ClientsModule } from '@nestjs/microservices';
import {
  DOCS_CLIENT,
  mqttClientOptions,
  ORDER_CLIENT,
  UPLOAD_CLIENT,
  USER_CLIENT,
  WECHAT_CLIENT,
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
      {
        name: DOCS_CLIENT,
        ...mqttClientOptions('gateway-docs'),
      },
      {
        name: UPLOAD_CLIENT,
        ...mqttClientOptions('gateway-upload'),
      },
      {
        name: WECHAT_CLIENT,
        ...mqttClientOptions('gateway-wechat'),
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
    @Inject(DOCS_CLIENT) private readonly docsClient: ClientProxy,
    @Inject(UPLOAD_CLIENT) private readonly uploadClient: ClientProxy,
    @Inject(WECHAT_CLIENT) private readonly wechatClient: ClientProxy,
  ) {}

  async onModuleInit() {
    await Promise.all([
      this.userClient.connect(),
      this.orderClient.connect(),
      this.docsClient.connect(),
      this.uploadClient.connect(),
      this.wechatClient.connect(),
    ]);
  }
}
