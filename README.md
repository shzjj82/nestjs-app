# NestJS MQTT 微服务 Monorepo

对外只暴露 **gateway:3000**。`usercenter` / `order` 通过 MQTT 通信，多个同名实例用 `$share` 共享订阅做负载均衡。

数据层使用 **PostgreSQL**（主库）和 **Redis**（缓存 / 会话），MQTT 用 Mosquitto。三种依赖都支持 **脚本安装** 和 **docker-compose**。

默认连接：

- `DATABASE_URL=postgres://nestjs:nestjs@127.0.0.1:5432/nestjs`
- `REDIS_URL=redis://127.0.0.1:6379`
- `MQTT_URL=mqtt://127.0.0.1:1883`

可复制 `.env.example` 为 `.env` 后按需修改。

## 本地开发

用 Docker 只起依赖（PostgreSQL + Redis + Mosquitto）：

```bash
npm run infra:up
```

再启动三个应用：

```bash
npm run start:dev
```

停止依赖：`npm run infra:down`，看日志：`npm run infra:logs`。

## 无 Docker：脚本安装 + PM2

适合 1 核小机器，进程比 Docker 更省内存。Linux 用 `sudo`，macOS 直接跑。

```bash
chmod +x scripts/*.sh

# 1. 安装 PostgreSQL + Redis
sudo ./scripts/install-db.sh
# 或分别安装：
# sudo ./scripts/install-postgres.sh
# sudo ./scripts/install-redis.sh

# 2. 安装并启动 MQTT
sudo ./scripts/install-mosquitto.sh

# 3. 启动全部服务：gateway + 3 个 usercenter + order
npm run pm2:start

# 云上只跑网关，微服务在本地：
MQTT_URL=mqtt://127.0.0.1:1883 PORT=3000 npm run pm2:start:gateway
```

常用命令：`npm run pm2:status` / `npm run pm2:logs` / `npm run pm2:restart` / `npm run pm2:stop`。  
开机自启：`pm2 startup && pm2 save`。

脚本默认只监听本机。如需远程连接：

```bash
sudo PG_BIND=0.0.0.0 ./scripts/install-postgres.sh
sudo REDIS_BIND=0.0.0.0 ./scripts/install-redis.sh
```

## Docker Compose（推荐）

默认 3 个 usercenter + 1 个 order，并带上 PostgreSQL / Redis / Mosquitto。请求地址始终是 `http://localhost:3000`：

```bash
npm run docker:up
```

或：

```bash
docker compose up --build --scale usercenter=3 --scale order=1
```

只起基础设施：

```bash
docker compose up -d postgres redis mosquitto
```

## 用户中心

一个人一行 `uc_users`。账密、多套微信小程序、多套支付宝小程序都是登录身份，挂在这个人上。**权限只有一套**，角色不按小程序拆。手机号全局唯一，用来合并账号。登录后下发 **access token**（默认 2 小时）和 **refresh token**（默认 30 天），存在 **Redis**；过期用 `POST /auth/refresh` 换新的一对。

启动后会种子：

- 接入端 `web`（账密）、`wechat`、`alipay`
- 全局角色 `admin` / `user`
- 管理员 `admin` / `admin123`

若从旧表升级，角色/功能点曾按 appId 拆过，启动可能因唯一约束失败，需要清掉 `uc_roles` / `uc_permissions` 旧数据或重建库。

### 注册 / 登录 / 查询

```bash
# 注册（phone 可选；已被占用则 409，请登录后绑定以合并）
curl -X POST http://localhost:3000/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"username":"carol","password":"pass123","nickname":"Carol","phone":"13800138000"}'

# 账密登录（username 也可以填手机号）
curl -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin123"}'

# 刷新 Token（旧 refresh 立即作废，返回新的一对）
curl -X POST http://localhost:3000/auth/refresh \
  -H 'Content-Type: application/json' \
  -d '{"refreshToken":"<refreshToken>"}'

# 当前用户
curl http://localhost:3000/auth/me \
  -H "Authorization: Bearer <token>"

# 查询用户（需要 user.query）
curl 'http://localhost:3000/users?keyword=carol' \
  -H "Authorization: Bearer <token>"
```

### 接入端（多套微信 / 支付宝小程序）

`uc_clients` 用你们的 **appCode** 区分接入端。微信小程序存微信 appId / appSecret，支付宝小程序存支付宝 appId / 私钥。列表不回传密钥。

```bash
# 微信登录
curl -X POST http://localhost:3000/auth/wechat \
  -H 'Content-Type: application/json' \
  -d '{"appCode":"wechat","code":"wx-login-code","nickname":"小程序用户","phone":"13800138000"}'

# 支付宝登录
curl -X POST http://localhost:3000/auth/alipay \
  -H 'Content-Type: application/json' \
  -d '{"appCode":"alipay","code":"alipay-auth-code","nickname":"支付宝用户"}'

# 再登记一套微信 / 支付宝（需要 client.manage）
curl -X POST http://localhost:3000/clients \
  -H "Authorization: Bearer <token>" \
  -H 'Content-Type: application/json' \
  -d '{"appCode":"mall","name":"商城小程序","type":"wechat_mp","wechatAppId":"wxaaaaaaaa","wechatSecret":"secret-a"}'

curl -X POST http://localhost:3000/clients \
  -H "Authorization: Bearer <token>" \
  -H 'Content-Type: application/json' \
  -d '{"appCode":"pay","name":"支付小程序","type":"alipay_mp","alipayAppId":"2021xxxx","alipayPrivateKey":"-----BEGIN PRIVATE KEY-----"}'
```

本地 `WECHAT_MOCK=1` 时，微信 `code` 映射成 `mock-${wechatAppId}-${code}`；支付宝在 `ALIPAY_MOCK=1` 或同样开了 `WECHAT_MOCK` 时走 mock。登录可带 `phone`，与账密账号合并。

### 绑定手机号（合并账号）

不发短信。手机号必须是 11 位大陆号（支持 `+86` / `86` 前缀）。同一手机号只能属于一个用户。

```bash
# 登录后绑定；若手机号已被另一账号占用，则合并并返回合并后用户的新 token
curl -X POST http://localhost:3000/auth/bind-phone \
  -H "Authorization: Bearer <token>" \
  -H 'Content-Type: application/json' \
  -d '{"phone":"13800138000"}'
```

合并规则：优先保留有密码+用户名的账号，分数相同则保留更早创建的。第三方身份和全局角色都会迁到保留侧。

### 权限与角色组

全站只有一套功能点和角色。管理员拥有全部功能点。

```bash
# 功能点列表
curl http://localhost:3000/permissions \
  -H "Authorization: Bearer <token>"

# 角色组勾选功能点
curl -X PUT http://localhost:3000/roles/<roleId>/permissions \
  -H "Authorization: Bearer <token>" \
  -H 'Content-Type: application/json' \
  -d '{"permissionIds":["...","..."]}'

# Excel 导出（功能点 + 角色勾选两个 sheet）
curl -L http://localhost:3000/permissions/export \
  -H "Authorization: Bearer <token>" \
  -o permissions.xlsx

# Excel 导入
curl -X POST http://localhost:3000/permissions/import \
  -H "Authorization: Bearer <token>" \
  -F file=@permissions.xlsx
```

Excel「功能点」表头：`模块 / 功能编码 / 功能名称 / 描述 / 排序`。  
「角色勾选」表头：`功能编码 / 功能名称 / <角色编码>...`，单元格填 `是` / `否`。

## 接口

网关默认按 `libs/common/src/gateway-routes.ts` 自动转发。表上可配 `auth`、`permissions`；`override: true` 的接口走手写 Controller。

- `POST /auth/register` / `POST /auth/login` / `POST /auth/wechat` / `POST /auth/alipay` / `POST /auth/refresh` — 公开
- `GET /auth/me` — 需要登录
- `POST /auth/logout` — 可带 access Token，或 body 里只传 `refreshToken`
- `GET /users` / `GET /users/:id` — `user.query`
- `POST /users` / `PATCH /users/:id` / `PUT /users/:id/roles` — 对应用户权限
- `GET|POST|PATCH /clients` — `client.manage`，Web / 微信 / 支付宝接入端
- `GET|POST|PATCH|DELETE /roles` 、 `PUT /roles/:id/permissions` — `role.manage`
- `GET|POST|PATCH|DELETE /permissions` — `permission.manage`
- `GET /permissions/export` / `POST /permissions/import` — Excel，手写覆盖
- `GET /orders` / `GET /orders/:id` — 无需登录
- `POST /orders` — 需要登录，并注入 `operatorId`

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin123"}' \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["data"]["token"])')

curl -X POST http://localhost:3000/users \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"username":"carol","password":"pass123","nickname":"Carol"}'

curl -X POST http://localhost:3000/orders \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"userId":"<userId>","item":"键盘","amount":199}'
```
