import mqtt, { type MqttClient } from 'mqtt';
import { mqttBrokerUrl } from './mqtt';

let client: MqttClient | null = null;
let connecting: Promise<MqttClient> | null = null;

async function getClient(): Promise<MqttClient> {
  if (client?.connected) {
    return client;
  }
  if (connecting) {
    return connecting;
  }
  connecting = new Promise<MqttClient>((resolve, reject) => {
    const next = mqtt.connect(mqttBrokerUrl(), {
      clientId: `bus-${process.pid}-${Math.random().toString(16).slice(2, 8)}`,
      reconnectPeriod: 1000,
    });
    const onConnect = () => {
      client = next;
      connecting = null;
      resolve(next);
    };
    next.once('connect', onConnect);
    next.once('error', (err) => {
      if (connecting) {
        connecting = null;
        reject(err);
      }
    });
  });
  return connecting;
}

/** 向 MQTT topic 发一条 JSON 事件（登录码状态等） */
export async function publishMqttJson(
  topic: string,
  payload: unknown,
): Promise<void> {
  const bus = await getClient();
  await new Promise<void>((resolve, reject) => {
    bus.publish(topic, JSON.stringify(payload), { qos: 1 }, (err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
}

/** 订阅 topic；返回取消订阅函数 */
export async function subscribeMqttJson(
  topic: string,
  onMessage: (payload: unknown) => void,
): Promise<() => void> {
  const bus = await getClient();
  const handler = (incoming: string, buf: Buffer) => {
    if (incoming !== topic) {
      return;
    }
    try {
      onMessage(JSON.parse(buf.toString('utf8')));
    } catch {
      onMessage(buf.toString('utf8'));
    }
  };
  await new Promise<void>((resolve, reject) => {
    bus.subscribe(topic, { qos: 1 }, (err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
  bus.on('message', handler);
  return () => {
    bus.off('message', handler);
    bus.unsubscribe(topic);
  };
}
