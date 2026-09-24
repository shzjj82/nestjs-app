import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { instanceId, mqttBrokerOptions } from '@app/common';
import { ensureDocsDatabase } from './database/ensure-database';
import { DocsModule } from './docs.module';

async function bootstrap() {
  await ensureDocsDatabase();
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    DocsModule,
    {
      transport: Transport.MQTT,
      options: mqttBrokerOptions('docs'),
    },
  );
  app.enableShutdownHooks();
  await app.listen();
  Logger.log(`docs 已接入 MQTT (${instanceId('docs')})`, 'Docs');
}

void bootstrap();
