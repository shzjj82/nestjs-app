import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { instanceId, mqttBrokerOptions } from '@app/common';
import { UploadModule } from './upload.module';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    UploadModule,
    {
      transport: Transport.MQTT,
      options: mqttBrokerOptions('upload'),
    },
  );
  app.enableShutdownHooks();
  await app.listen();
  Logger.log(`upload 已接入 MQTT (${instanceId('upload')})`, 'Upload');
}

void bootstrap();
