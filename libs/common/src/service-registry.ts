import {
  AGENTS_CLIENT,
  DOCS_CLIENT,
  MQTT_GROUPS,
  MQTT_PATTERNS,
  NOTIFY_CLIENT,
  ORDER_CLIENT,
  RECYCLE_CLIENT,
  UPLOAD_CLIENT,
  USER_CLIENT,
  WECHAT_CLIENT,
  WIKI_CLIENT,
} from './patterns';

export interface MicroserviceEntry {
  /** 进程 / 业务名，如 usercenter */
  name: string;
  /** MQTT ClientProxy 注入 token */
  client: string;
  /** $share 分组 */
  group: string;
  /** 健康检查 pattern（无则不进 /health 探测） */
  health?: string;
  /** 接口文档 pattern */
  apiDocs?: string;
  /** 网关出站 MQTT clientId 前缀 */
  gatewayClientId: string;
  /**
   * 网关 HTTP 代理挂载的一级路径（不含 auth 等跨服务入口）。
   * 同一服务可挂多条；未列出的路径（如 /auth）仍在 proxy.routes 手写。
   */
  proxyPrefixes?: string[];
}

/**
 * 微服务登记表：网关 MQTT 客户端、健康检查、接口文档、代理前缀共用这一份。
 * 新增服务时先改这里，再补 GATEWAY_ROUTES / MQTT_PATTERNS。
 */
export const MICROSERVICES: readonly MicroserviceEntry[] = [
  {
    name: 'usercenter',
    client: USER_CLIENT,
    group: MQTT_GROUPS.USERCENTER,
    health: MQTT_PATTERNS.USER_HEALTH,
    apiDocs: MQTT_PATTERNS.USER_API_DOCS,
    gatewayClientId: 'gateway-user',
    proxyPrefixes: [
      'users',
      'accounts',
      'businesses',
      'clients',
      'roles',
      'permissions',
    ],
  },
  {
    name: 'order',
    client: ORDER_CLIENT,
    group: MQTT_GROUPS.ORDER,
    health: MQTT_PATTERNS.ORDER_HEALTH,
    apiDocs: MQTT_PATTERNS.ORDER_API_DOCS,
    gatewayClientId: 'gateway-order',
    proxyPrefixes: ['orders'],
  },
  {
    name: 'docs',
    client: DOCS_CLIENT,
    group: MQTT_GROUPS.DOCS,
    health: MQTT_PATTERNS.DOC_HEALTH,
    apiDocs: MQTT_PATTERNS.DOC_API_DOCS,
    gatewayClientId: 'gateway-docs',
    proxyPrefixes: ['docs'],
  },
  {
    name: 'wiki',
    client: WIKI_CLIENT,
    group: MQTT_GROUPS.WIKI,
    health: MQTT_PATTERNS.WIKI_HEALTH,
    apiDocs: MQTT_PATTERNS.WIKI_API_DOCS,
    gatewayClientId: 'gateway-wiki',
    proxyPrefixes: ['wiki'],
  },
  {
    name: 'upload',
    client: UPLOAD_CLIENT,
    group: MQTT_GROUPS.UPLOAD,
    health: MQTT_PATTERNS.UPLOAD_HEALTH,
    apiDocs: MQTT_PATTERNS.UPLOAD_API_DOCS,
    gatewayClientId: 'gateway-upload',
    proxyPrefixes: ['upload'],
  },
  {
    name: 'wechat',
    client: WECHAT_CLIENT,
    group: MQTT_GROUPS.WECHAT,
    health: MQTT_PATTERNS.WECHAT_HEALTH,
    apiDocs: MQTT_PATTERNS.WECHAT_API_DOCS,
    gatewayClientId: 'gateway-wechat',
    proxyPrefixes: ['wechat'],
  },
  {
    name: 'agents',
    client: AGENTS_CLIENT,
    group: MQTT_GROUPS.AGENTS,
    health: MQTT_PATTERNS.AGENTS_HEALTH,
    apiDocs: MQTT_PATTERNS.AGENTS_API_DOCS,
    gatewayClientId: 'gateway-agents',
    proxyPrefixes: ['agents'],
  },
  {
    name: 'recycle',
    client: RECYCLE_CLIENT,
    group: MQTT_GROUPS.RECYCLE,
    health: MQTT_PATTERNS.RECYCLE_HEALTH,
    apiDocs: MQTT_PATTERNS.RECYCLE_API_DOCS,
    gatewayClientId: 'gateway-recycle',
    proxyPrefixes: ['recycle'],
  },
  {
    name: 'notify',
    client: NOTIFY_CLIENT,
    group: MQTT_GROUPS.NOTIFY,
    health: MQTT_PATTERNS.NOTIFY_HEALTH,
    apiDocs: MQTT_PATTERNS.NOTIFY_API_DOCS,
    gatewayClientId: 'gateway-notify',
    proxyPrefixes: ['notifications', 'todos'],
  },
] as const;

export function microserviceByClient(client: string): MicroserviceEntry | undefined {
  return MICROSERVICES.find((item) => item.client === client);
}

export function microserviceHealthProbes(): Array<{
  client: string;
  pattern: string;
  service: string;
}> {
  return MICROSERVICES.filter(
    (item): item is MicroserviceEntry & { health: string } => !!item.health,
  ).map((item) => ({
    client: item.client,
    pattern: item.health,
    service: item.name,
  }));
}

export function microserviceApiDocs(): Array<{
  client: string;
  service: string;
  pattern: string;
}> {
  return MICROSERVICES.filter(
    (item): item is MicroserviceEntry & { apiDocs: string } => !!item.apiDocs,
  ).map((item) => ({
    client: item.client,
    service: item.name,
    pattern: item.apiDocs,
  }));
}

/** 网关 ClientsModule.register 用 */
export function gatewayMqttClientEntries(): Array<{
  name: string;
  gatewayClientId: string;
}> {
  return MICROSERVICES.map((item) => ({
    name: item.client,
    gatewayClientId: item.gatewayClientId,
  }));
}

/** 由登记表生成一级代理路径（auth 等跨服务入口另写） */
export function microserviceProxyPrefixes(): string[] {
  const prefixes: string[] = [];
  for (const item of MICROSERVICES) {
    for (const prefix of item.proxyPrefixes ?? []) {
      if (!prefixes.includes(prefix)) {
        prefixes.push(prefix);
      }
    }
  }
  return prefixes;
}
