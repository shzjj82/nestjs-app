# nestjs 项目长期约定

## 交付物位置
- **文档类交付物（md / 接口文档 / 说明）不要写进项目目录**，会污染仓库。
  输出到项目外，例如 `/Users/zhangjingjie/Documents/`。
- 代码、迁移、配置等运行时需要的文件照常放项目内。

## 架构约定
- 微服务之间通过 MQTT pattern 通信，跨上下文调用优先用事件而非模块 import，
  保持限界上下文零编译期依赖。
- 新服务需同步改：`nest-cli.json`、`package.json`（build/start/start:dev）、
  `ecosystem.config.cjs`、`scripts/pm2-start.sh`、网关 `client.hub.ts` + `mqtt.module.ts` +
  `proxy.routes.ts`、`libs/common/src/gateway-routes.ts`。
- 权限码在 `libs/common/src/types.ts` 的 `PERMISSIONS`，且必须在
  `apps/usercenter/src/database/seed.service.ts` 的 `DEFAULT_PERMISSIONS` 里补播种条目。
- 业务角色建在业务下（`businessId` 非空），不要建平台级角色。

## 回收服务（apps/recycle）设计基线
- 授权模型：动作 × 角色 × 起始状态，集中在 `policy/transitions.ts` 的转移矩阵。
- 不提供 PATCH 改 status 的接口；同语义不同身份拆成不同 action。
- 订单状态用 PostgreSQL 原生枚举 `recycle_order_status`。
- orders 与 approvals 通过 `recycle.evt.approval.requested` / `.decided` 事件互通，
  内部事件必须携带 `RECYCLE_INTERNAL_KEY`。

## 订阅消息模板的归属（已定，勿反复）
- `template_id` 宿主是小程序（只在 appId 下有效），场景名是业务语义 —— 两者**都放在
  `wx_miniprograms.subscribe_templates`**（`{ 场景: { templateId, fields } }`）。
  依据：发送发生在 wechat 服务内、调用方只带 `(appId, scene)`，这样查表零跨服务调用；
  且本表 `code` 就是业务 code，业务与小程序 1:1。
- 代价已知并接受：将来若「一业务多小程序」或「一小程序多业务」，同名场景会串味，
  迁移方向是把键扩展成 `(businessCode, appId, scene)`。
- 字段映射取值必须在 `SUBSCRIBE_SEMANTICS` 内，否则微信不报错但渲染成空串。
- 写入是**整份替换**语义，不深合并。

## 验证方式
- 类型检查：`npx tsc -p apps/<app>/tsconfig.app.json --noEmit`；admin 用
  `npx tsc --noEmit -p tsconfig.json`（在 apps/admin 下）。
- 单测：`npx jest apps/<app>`（jest 较慢，单个 app 约 100s，注意超时）
- **jest 加载不了任何 `import '@nestjs/typeorm'` 的模块**（ESM/CJS 冲突，本机 Node 22）。
  带 DI 的 service 测不了 → 校验逻辑抽成纯函数模块才能测。
- `nest build` 在本机沙箱下会因禁止写 `dist/` 失败，**且失败前会先清空 `dist/apps/<app>`**，
  慎用（会删掉已有产物）。
- 跑服务用 tsc 产物：`npx tsc -p apps/<app>/tsconfig.app.json` 产出
  `dist/apps/<app>/apps/<app>/src/main.js`；建软链
  `dist/apps/<app>/node_modules/@app/common -> ../../libs/common/src`；
  再 `node dist/apps/<app>/apps/<app>/src/main.js`（cwd 必须项目根）。
  此路不需要 tsconfig-paths。
- 直连微服务验证：`ClientProxyFactory` + `mqttClientOptions('名字')`，按 `MQTT_PATTERNS`
  里**原始 pattern** send（服务端订阅 `$share/<group>/<pattern>`，客户端发原始 topic）。
  RpcException 经 MQTT 回来是明文 `{ status, message }`，网关据此映射 HTTP 状态码。
- 长驻服务用 Bash 的 `run_in_background`，`nohup ... &` 会被回收。
