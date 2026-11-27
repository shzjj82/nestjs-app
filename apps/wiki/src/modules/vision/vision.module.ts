import { Module } from '@nestjs/common';
import { ClientsModule } from '@nestjs/microservices';
import { AGENTS_CLIENT, mqttClientOptions } from '@app/common';
import { WikiVisionController } from './vision.controller';
import { WikiVisionService } from './vision.service';

@Module({
  imports: [
    ClientsModule.register([{ name: AGENTS_CLIENT, ...mqttClientOptions('wiki-vision') }]),
  ],
  controllers: [WikiVisionController],
  providers: [WikiVisionService],
})
export class VisionModule {}
