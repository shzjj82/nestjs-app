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

interface TopicEntry {
  listeners: Set<(payload: unknown) => void>;
  stop: () => void;
}

/**
 * 同一 topic 多路复用：网关 WebSocket / SSE 共用一条 MQTT 订阅，
 * 最后一个听众离开时再退订。
 */
export class MqttTopicHub {
  private readonly topics = new Map<string, TopicEntry>();
  private readonly opening = new Map<string, Promise<TopicEntry>>();

  async listen(
    topic: string,
    listener: (payload: unknown) => void,
  ): Promise<() => void> {
    const entry = await this.entry(topic);
    entry.listeners.add(listener);
    return () => {
      entry.listeners.delete(listener);
      if (entry.listeners.size === 0 && this.topics.get(topic) === entry) {
        entry.stop();
        this.topics.delete(topic);
      }
    };
  }

  private async entry(topic: string): Promise<TopicEntry> {
    const existing = this.topics.get(topic);
    if (existing) {
      return existing;
    }
    let opening = this.opening.get(topic);
    if (!opening) {
      opening = this.open(topic);
      this.opening.set(topic, opening);
    }
    try {
      return await opening;
    } finally {
      this.opening.delete(topic);
    }
  }

  private async open(topic: string): Promise<TopicEntry> {
    const listeners = new Set<(payload: unknown) => void>();
    const stop = await subscribeMqttJson(topic, (payload) => {
      for (const listener of listeners) {
        listener(payload);
      }
    });
    const entry = { listeners, stop };
    this.topics.set(topic, entry);
    return entry;
  }
}
