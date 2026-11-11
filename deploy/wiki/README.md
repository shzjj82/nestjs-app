# wiki 业务开通

本目录只负责把 `wiki` 业务登记进 usercenter，并按功能点目录开通编辑器需要的接口白名单。登录仍在 usercenter；团队与文档由 `apps/wiki` 提供。

```
deploy/wiki/
  .env.example
  .env                 # 不提交
  README.md
  scripts/bootstrap.ts
```

```bash
cp deploy/wiki/.env.example deploy/wiki/.env
# 编辑 MQTT_URL 等
set -a && . ./deploy/wiki/.env && set +a
npm run wiki:bootstrap
```

幂等：业务已存在则只补齐缺失接口。可先设 `WIKI_BOOTSTRAP_DRY_RUN=1` 预览。
