import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { instanceId, mqttBrokerOptions } from '@app/common';
import { ensureMedicalDatabase } from './database/ensure-database';
import { HttpRpcFilter } from './http-rpc.filter';
import { MedicalModule } from './medical.module';

async function bootstrap() {
  await ensureMedicalDatabase();
  const app = await NestFactory.create(MedicalModule);
  const mqtt = app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.MQTT,
    options: mqttBrokerOptions('medical'),
  });
  mqtt.useGlobalFilters(new HttpRpcFilter());
  app.enableShutdownHooks();
  await app.startAllMicroservices();
  const port = Number(process.env.MEDICAL_HTTP_PORT ?? 3011);
  await app.listen(port);
  Logger.log(`medical 已接入 MQTT，流式 HTTP :${port} (${instanceId('medical')})`, 'Medical');
}

void bootstrap();
