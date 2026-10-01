import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { instanceId, mqttBrokerOptions } from '@app/common';
import { ensureAgentsDatabase } from './database/ensure-database';
import { AgentsModule } from './agents.module';

async function bootstrap() {
  await ensureAgentsDatabase();
  const app = await NestFactory.create(AgentsModule);
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.MQTT,
    options: mqttBrokerOptions('agents'),
  });
  app.enableShutdownHooks();
  await app.startAllMicroservices();
  const port = Number(process.env.AGENTS_HTTP_PORT ?? 3006);
  await app.listen(port);
  Logger.log(
    `agents 已接入 MQTT，流式 HTTP :${port} (${instanceId('agents')})`,
    'Agents',
  );
}

void bootstrap();
