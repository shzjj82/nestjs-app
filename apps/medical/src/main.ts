import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { instanceId, mqttBrokerOptions } from '@app/common';
import { ensureMedicalDatabase } from './database/ensure-database';
import { HttpRpcFilter } from './http-rpc.filter';
import { MedicalModule } from './medical.module';

async function bootstrap() {
  await ensureMedicalDatabase();
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    MedicalModule,
    {
      transport: Transport.MQTT,
      options: mqttBrokerOptions('medical'),
    },
  );
  app.enableShutdownHooks();
  app.useGlobalFilters(new HttpRpcFilter());
  await app.listen();
  Logger.log(`medical 已接入 MQTT (${instanceId('medical')})`, 'Medical');
}

void bootstrap();
