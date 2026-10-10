import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { instanceId, mqttBrokerOptions } from '@app/common';
import { ensureRecycleDatabase } from './database/ensure-database';
import { RecycleModule } from './recycle.module';

async function bootstrap() {
  await ensureRecycleDatabase();
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    RecycleModule,
    {
      transport: Transport.MQTT,
      options: mqttBrokerOptions('recycle'),
    },
  );
  app.enableShutdownHooks();
  await app.listen();
  Logger.log(`recycle 已接入 MQTT (${instanceId('recycle')})`, 'Recycle');
}

void bootstrap();
