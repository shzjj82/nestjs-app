import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { instanceId, mqttBrokerOptions } from '@app/common';
import { ensureWechatDatabase } from './database/ensure-database';
import { WechatModule } from './wechat.module';

async function bootstrap() {
  await ensureWechatDatabase();
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    WechatModule,
    {
      transport: Transport.MQTT,
      options: mqttBrokerOptions('wechat'),
    },
  );
  app.enableShutdownHooks();
  await app.listen();
  Logger.log(`wechat 已接入 MQTT (${instanceId('wechat')})`, 'Wechat');
}

void bootstrap();
