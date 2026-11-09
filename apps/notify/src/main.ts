import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { instanceId, mqttBrokerOptions } from '@app/common';
import { ensureNotifyDatabase } from './database/ensure-database';
import { NotifyModule } from './notify.module';

async function bootstrap() {
  await ensureNotifyDatabase();
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    NotifyModule,
    {
      transport: Transport.MQTT,
      options: mqttBrokerOptions('notify'),
    },
  );
  app.enableShutdownHooks();
  await app.listen();
  Logger.log(`notify 已接入 MQTT (${instanceId('notify')})`, 'Notify');
}

void bootstrap();
