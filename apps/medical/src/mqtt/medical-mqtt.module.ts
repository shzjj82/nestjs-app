import { Global, Inject, Module, OnModuleInit } from '@nestjs/common';
import { ClientProxy, ClientsModule } from '@nestjs/microservices';
import { AGENTS_CLIENT, AgentsClient, mqttClientOptions, UPLOAD_CLIENT, UploadClient } from '@app/common';

/**
 * medical 进程的 MQTT 出站连接。
 * 舌象等文件转 upload；语音 / 对话 / 语言抽取转 agents。业务模块不要直连上游模型。
 */
@Global()
@Module({
  imports: [
    ClientsModule.register([
      {
        name: UPLOAD_CLIENT,
        ...mqttClientOptions('medical-to-upload'),
      },
      {
        name: AGENTS_CLIENT,
        ...mqttClientOptions('medical-to-agents'),
      },
    ]),
  ],
  providers: [AgentsClient, UploadClient],
  exports: [ClientsModule, AgentsClient, UploadClient],
})
export class MedicalMqttModule implements OnModuleInit {
  constructor(
    @Inject(UPLOAD_CLIENT) private readonly upload: ClientProxy,
    @Inject(AGENTS_CLIENT) private readonly agents: ClientProxy,
  ) {}

  async onModuleInit() {
    await this.upload.connect();
    await this.agents.connect();
  }
}
