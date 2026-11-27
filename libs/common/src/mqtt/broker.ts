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

export function appVersion(): string {
  return process.env.APP_VERSION ?? process.env.npm_package_version ?? '0.0.1';
}

export interface ServiceHealth {
  status: 'ok' | 'up' | 'down';
  service: string;
  instance: string;
  version: string;
}

export function serviceHealth(
  service: string,
  extras: Record<string, unknown> = {},
): ServiceHealth & Record<string, unknown> {
  return {
    status: 'up',
    service,
    instance: instanceId(service),
    version: appVersion(),
    ...extras,
  };
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
