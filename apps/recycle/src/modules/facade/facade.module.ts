import { Module } from '@nestjs/common';
import { RecycleMqttModule } from '../mqtt/recycle-mqtt.module';
import { AuthProxy } from './auth-proxy';
import { FacadeController } from './facade.controller';

@Module({
  imports: [RecycleMqttModule],
  controllers: [FacadeController],
  providers: [AuthProxy],
})
export class FacadeModule {}
