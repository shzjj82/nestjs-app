# NestJS MQTT 微服务 Monorepo

对外只暴露 **gateway:3000**。`usercenter` / `order` 通过 MQTT 通信，多个同名实例用 `$share` 共享订阅做负载均衡。

## 本地开发

先启动 MQTT broker：

```bash
docker compose up mosquitto
```

再启动三个应用：

```bash
npm run start:dev
```

## 无 Docker：Mosquitto + PM2

适合 1 核小机器，进程比 Docker 更省内存。

```bash
# 1. 安装并启动 MQTT（Linux 用 sudo，macOS 直接跑）
sudo ./scripts/install-mosquitto.sh

# 2. 启动全部服务：gateway + 3 个 usercenter + order
chmod +x scripts/*.sh
npm run pm2:start

# 云上只跑网关，微服务在本地：
MQTT_URL=mqtt://127.0.0.1:1883 PORT=3000 npm run pm2:start:gateway
```

常用命令：`npm run pm2:status` / `npm run pm2:logs` / `npm run pm2:restart` / `npm run pm2:stop`。  
开机自启：`pm2 startup && pm2 save`。

## Docker Compose（推荐）

默认 3 个 usercenter + 1 个 order，请求地址始终是 `http://localhost:3000`：

```bash
npm run docker:up
```

或：

```bash
docker compose up --build --scale usercenter=3 --scale order=1
```

## 接口

网关默认按 `libs/common/src/gateway-routes.ts` 自动转发。表上可配 `auth`；`override: true` 的接口走手写 Controller。

- `GET /health` — 网关探活
- `GET /users` / `GET /users/:id` — 通用转发，无需登录
- `POST /users` — 通用转发，需要 `Authorization: Bearer demo`
- `GET /orders` / `GET /orders/:id` — 通用转发，无需登录
- `POST /orders` — 手写覆盖，需要登录，并注入 `operatorId`

演示 Token：`demo`（普通用户）、`demo-admin`（管理员）。

```bash
curl -X POST http://localhost:3000/users \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer demo' \
  -d '{"name":"Carol","email":"carol@example.com"}'

curl -X POST http://localhost:3000/orders \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer demo' \
  -d '{"userId":"u-1","item":"键盘","amount":199}'
```

预置用户：`u-1`（Alice）、`u-2`（Bob）。响应里的 `instance` 会随命中的副本变化。
