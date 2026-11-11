import { Module } from '@nestjs/common';
import { ClientsModule } from '@nestjs/microservices';
import {
  AGENTS_CLIENT,
  NOTIFY_CLIENT,
  UPLOAD_CLIENT,
  mqttClientOptions,
} from '@app/common';
import { FacadeController } from './facade.controller';
import { PlatformProxy } from './platform-proxy';

@Module({
  imports: [
    ClientsModule.register([
      { name: UPLOAD_CLIENT, ...mqttClientOptions('wiki-to-upload') },
      { name: AGENTS_CLIENT, ...mqttClientOptions('wiki-to-agents') },
      { name: NOTIFY_CLIENT, ...mqttClientOptions('wiki-to-notify') },
    ]),
  ],
  controllers: [FacadeController],
  providers: [PlatformProxy],
})
export class FacadeModule {}
