# recycle 最小部署

只跑回收业务需要的 5 个进程：`gateway` / `usercenter` / `upload` / `wechat` / `recycle`。不跑 order / docs / agents。

```
deploy/recycle/
  .env.example            # 提交：需要哪些变量
  .env                    # 不提交：真实密钥
  ecosystem.config.cjs    # PM2：这 5 个进程
  docker-compose.yml      # Docker：同一组进程
  scripts/                # 启停与开通
    start.sh
    reload.sh
    bootstrap.ts
  db/                     # 建库 / 切库
    switch.sh
    tool.cjs
```

PM2（本机已有 Postgres / Redis / MQTT）：

```bash
cp deploy/recycle/.env.example deploy/recycle/.env
npm run recycle:start
```

Docker（基础设施 + 5 个服务一起拉起）：

```bash
cp deploy/recycle/.env.example deploy/recycle/.env
npm run recycle:docker:up
npm run recycle:bootstrap
```
