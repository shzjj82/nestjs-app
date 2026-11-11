import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { instanceId, mqttBrokerOptions } from '@app/common';
import { ensureWikiDatabase } from './database/ensure-database';
import { WikiModule } from './wiki.module';

async function bootstrap() {
  await ensureWikiDatabase();
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    WikiModule,
    {
      transport: Transport.MQTT,
      options: mqttBrokerOptions('wiki'),
    },
  );
  app.enableShutdownHooks();
  await app.listen();
  Logger.log(`wiki 已接入 MQTT (${instanceId('wiki')})`, 'Wiki');
}

void bootstrap();
