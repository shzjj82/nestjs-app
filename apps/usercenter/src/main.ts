import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { instanceId, mqttBrokerOptions } from '@app/common';
import { UsercenterModule } from './usercenter.module';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    UsercenterModule,
    {
      transport: Transport.MQTT,
      options: mqttBrokerOptions('usercenter'),
    },
  );
  app.enableShutdownHooks();
  await app.listen();
  Logger.log(
    `usercenter 已接入 MQTT (${instanceId('usercenter')})`,
    'Usercenter',
  );
}

void bootstrap();
