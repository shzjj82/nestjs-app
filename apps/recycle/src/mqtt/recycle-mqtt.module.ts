import { Global, Inject, Module, OnModuleInit } from '@nestjs/common';
import { ClientProxy, ClientsModule } from '@nestjs/microservices';
import {
  mqttClientOptions,
  RECYCLE_CLIENT,
  UPLOAD_CLIENT,
  USER_CLIENT,
  WECHAT_CLIENT,
} from '@app/common';

/**
 * 回收进程只建一组 MQTT 出站连接。
 * 原先 orders / stores / identity / approvals 各自 ClientsModule.register，
 * 同一进程会占多个 broker clientId。
 */
@Global()
@Module({
  imports: [
    ClientsModule.register([
      {
        name: RECYCLE_CLIENT,
        ...mqttClientOptions('recycle-bus'),
      },
      {
        name: WECHAT_CLIENT,
        ...mqttClientOptions('recycle-to-wechat'),
      },
      {
        name: USER_CLIENT,
        ...mqttClientOptions('recycle-to-user'),
      },
      {
        name: UPLOAD_CLIENT,
        ...mqttClientOptions('recycle-to-upload'),
      },
    ]),
  ],
  exports: [ClientsModule],
})
export class RecycleMqttModule implements OnModuleInit {
  constructor(
    @Inject(RECYCLE_CLIENT) private readonly bus: ClientProxy,
    @Inject(WECHAT_CLIENT) private readonly wechat: ClientProxy,
    @Inject(USER_CLIENT) private readonly users: ClientProxy,
    @Inject(UPLOAD_CLIENT) private readonly upload: ClientProxy,
  ) {}

  async onModuleInit() {
    await Promise.all([
      this.bus.connect(),
      this.wechat.connect(),
      this.users.connect(),
      this.upload.connect(),
    ]);
  }
}
