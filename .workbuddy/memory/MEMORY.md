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

## 验证方式
- 类型检查：`npx tsc -p apps/<app>/tsconfig.app.json --noEmit`
- 单测：`npx jest apps/<app>`（jest 较慢，单个 app 约 100s，注意超时）
- `nest build` 在本机沙箱下会因禁止写 `dist/` 失败，非代码问题
