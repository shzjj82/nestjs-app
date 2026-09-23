import { BadGatewayException, Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ORDER_CLIENT, USER_CLIENT } from '@app/common';
import { MqttProxy } from './mqtt.proxy';

@Injectable()
export class ClientHub {
  private readonly clients: Record<string, ClientProxy>;

  constructor(
    @Inject(USER_CLIENT) userClient: ClientProxy,
    @Inject(ORDER_CLIENT) orderClient: ClientProxy,
    private readonly mqtt: MqttProxy,
  ) {
    this.clients = {
      [USER_CLIENT]: userClient,
      [ORDER_CLIENT]: orderClient,
    };
  }

  get(name: string): ClientProxy {
    const client = this.clients[name];
    if (!client) {
      throw new BadGatewayException(`未注册的 MQTT 客户端: ${name}`);
    }
    return client;
  }

  send<T>(name: string, pattern: string, data: unknown = {}) {
    return this.mqtt.send<T>(this.get(name), pattern, data);
  }
}
