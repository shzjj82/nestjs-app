# medical 最小部署

只跑中医诊所需要的进程：`gateway` / `usercenter` / `upload` / `medical` / `agents`。不跑 order / docs / wechat / recycle。语音识别和听悟任务在 agents，medical 只组诊所业务。

诊所登录走 `POST /medical/auth/login`（医生 / 医助），不是 usercenter JWT。网关要求请求头 `X-Biz-Code: medical`。

```
deploy/medical/
  .env.example            # 提交：需要哪些变量
  .env                    # 不提交：真实密钥
  ecosystem.config.cjs    # PM2：gateway / usercenter / upload / medical / agents
  docker-compose.yml      # Docker：同一组进程
  scripts/
    start.sh
    reload.sh
    bootstrap.ts
  db/
    switch.sh
    tool.cjs
```

PM2（本机已有 Postgres / Redis / MQTT）：

```bash
cp deploy/medical/.env.example deploy/medical/.env
npm run medical:start
```

Docker（基础设施 + 诊所服务一起拉起）：

```bash
cp deploy/medical/.env.example deploy/medical/.env
npm run medical:docker:up
npm run medical:bootstrap
```
