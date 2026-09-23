import { Transport } from '@nestjs/microservices';

export function mqttBrokerUrl(): string {
  return process.env.MQTT_URL ?? 'mqtt://127.0.0.1:1883';
}

export function instanceId(service: string): string {
  return (
    process.env.INSTANCE_ID ??
    process.env.HOSTNAME ??
    `${service}-${process.pid}`
  );
}

export function mqttBrokerOptions(service: string) {
  return {
    url: mqttBrokerUrl(),
    clientId: `${instanceId(service)}-${Math.random().toString(16).slice(2, 8)}`,
    keepalive: 30,
    reconnectPeriod: 1000,
    subscribeOptions: { qos: 1 as const },
  };
}

export function mqttClientOptions(service: string) {
  return {
    transport: Transport.MQTT as const,
    options: mqttBrokerOptions(service),
  };
}
