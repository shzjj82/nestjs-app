import { Inject, Module, OnModuleInit } from '@nestjs/common';
import { ClientProxy, ClientsModule } from '@nestjs/microservices';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  mqttClientOptions,
  UPLOAD_CLIENT,
  UploadClient,
  WECHAT_CLIENT,
} from '@app/common';
import { RecycleStoreEntity, RecycleStoreStaffEntity } from '../entities';
import { StoresController } from './stores.controller';
import { StoresService } from './stores.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([RecycleStoreEntity, RecycleStoreStaffEntity]),
    ClientsModule.register([
      {
        name: WECHAT_CLIENT,
        ...mqttClientOptions('recycle-stores-to-wechat'),
      },
      {
        name: UPLOAD_CLIENT,
        ...mqttClientOptions('recycle-stores-to-upload'),
      },
    ]),
  ],
  controllers: [StoresController],
  providers: [StoresService, UploadClient],
  exports: [StoresService],
})
export class StoresModule implements OnModuleInit {
  constructor(@Inject(WECHAT_CLIENT) private readonly wechat: ClientProxy) {}

  async onModuleInit() {
    await this.wechat.connect();
  }
}
