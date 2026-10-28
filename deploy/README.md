# 发布场景

根目录只保留**全量开发/全量部署**：`.env.example`、`ecosystem.config.cjs`、`scripts/pm2/`。

每个对外交付的裁剪部署自成一个目录：

```
deploy/<场景>/
  README.md
  .env.example            # 提交
  .env                    # 不提交
  ecosystem.config.cjs    # PM2：该场景要跑哪些进程（script 路径相对仓库根）
  docker-compose.yml      # Docker：同一组进程；镜像/Dockerfile 仍用仓库根 docker/
  scripts/                # 启停、开通
  db/                     # 仅该场景需要时
```

新增场景时复制 `deploy/recycle/` 再改进程列表和环境变量，不要往根目录再加 `ecosystem.xxx.config.cjs` / `.env.xxx`。

启动必须在仓库根执行（或由脚本 `cd` 到根），因为 PM2 的 `script` 是 `dist/apps/<服务>/main.js`。
