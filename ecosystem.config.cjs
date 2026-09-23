const mqttUrl = process.env.MQTT_URL ?? 'mqtt://127.0.0.1:1883';
const gatewayPort = process.env.PORT ?? '3000';
const usercenterReplicas = Number(process.env.USERCENTER_REPLICAS ?? 3);

const usercenterApps = Array.from({ length: usercenterReplicas }, (_, index) => {
  const id = index + 1;
  return {
    name: `usercenter-${id}`,
    script: 'dist/apps/usercenter/main.js',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    max_memory_restart: '300M',
    env: {
      NODE_ENV: 'production',
      MQTT_URL: mqttUrl,
      INSTANCE_ID: `usercenter-${id}`,
    },
  };
});

module.exports = {
  apps: [
    {
      name: 'gateway',
      script: 'dist/apps/gateway/main.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '400M',
      env: {
        NODE_ENV: 'production',
        MQTT_URL: mqttUrl,
        PORT: gatewayPort,
      },
    },
    ...usercenterApps,
    {
      name: 'order',
      script: 'dist/apps/order/main.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
        MQTT_URL: mqttUrl,
        INSTANCE_ID: 'order-1',
      },
    },
  ],
};
