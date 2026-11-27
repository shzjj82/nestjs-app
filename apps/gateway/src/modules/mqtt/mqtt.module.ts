import { Module } from '@nestjs/common';
import { ClientsModule, type ClientsModuleOptions } from '@nestjs/microservices';
import { gatewayMqttClientEntries, mqttClientOptions } from '@app/common';
import { ClientHub } from './client.hub';
import { MqttProxy } from './mqtt.proxy';

const gatewayClients = gatewayMqttClientEntries().map((item) => ({
  name: item.name,
  ...mqttClientOptions(item.gatewayClientId),
}));

@Module({
  imports: [ClientsModule.register(gatewayClients as ClientsModuleOptions)],
  providers: [MqttProxy, ClientHub],
  exports: [ClientsModule, MqttProxy, ClientHub],
})
export class MqttModule {}
