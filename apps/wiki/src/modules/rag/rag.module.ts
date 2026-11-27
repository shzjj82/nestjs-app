import { Module } from '@nestjs/common';
import { ClientsModule } from '@nestjs/microservices';
import { AGENTS_CLIENT, mqttClientOptions } from '@app/common';
import { WikiRagController } from './rag.controller';
import { WikiRagService } from './rag.service';

@Module({
  imports: [
    ClientsModule.register([{ name: AGENTS_CLIENT, ...mqttClientOptions('wiki-rag') }]),
  ],
  controllers: [WikiRagController],
  providers: [WikiRagService],
})
export class RagModule {}
