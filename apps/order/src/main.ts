import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { instanceId, mqttBrokerOptions } from '@app/common';
import { ensureOrderDatabase } from './database/ensure-database';
import { OrderModule } from './order.module';

async function bootstrap() {
  await ensureOrderDatabase();
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    OrderModule,
    {
      transport: Transport.MQTT,
      options: mqttBrokerOptions('order'),
    },
  );
  app.enableShutdownHooks();
  await app.listen();
  Logger.log(`order 已接入 MQTT (${instanceId('order')})`, 'Order');
}

void bootstrap();
