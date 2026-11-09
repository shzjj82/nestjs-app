import {
  BadGatewayException,
  Injectable,
  OnModuleInit,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { ClientProxy } from '@nestjs/microservices';
import { MICROSERVICES } from '@app/common';
import { MqttProxy } from './mqtt.proxy';

@Injectable()
export class ClientHub implements OnModuleInit {
  private readonly clients: Record<string, ClientProxy> = {};

  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly mqtt: MqttProxy,
  ) {}

  async onModuleInit() {
    for (const entry of MICROSERVICES) {
      this.clients[entry.client] = this.moduleRef.get<ClientProxy>(entry.client, {
        strict: false,
      });
    }
    await Promise.all(
      Object.values(this.clients).map((client) => client.connect()),
    );
  }

  get(name: string): ClientProxy {
    const client = this.clients[name];
    if (!client) {
      throw new BadGatewayException(`未注册的 MQTT 客户端: ${name}`);
    }
    return client;
  }

  send<T>(name: string, pattern: string, data: unknown = {}, timeoutMs?: number) {
    return this.mqtt.send<T>(this.get(name), pattern, data, timeoutMs);
  }
}
