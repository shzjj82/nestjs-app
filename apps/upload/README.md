# upload

文件上传微服务：只负责把文件存到对象存储。文档、账号不在这里。

调用方走网关 HTTP；本进程订 MQTT。同步直写存储，异步先入 Redis 队列再由 worker 上传。

## 目录

```
src/
  main.ts                 启动 MQTT 微服务
  upload.module.ts        组装各领域模块
  upload.controller.ts    健康检查
  common/                 RPC、对象键、入参解析
  storage/                驱动门面；minio / oss / cos
  objects/                同步上传、删除对象
  jobs/                   异步入队、查任务、Redis worker
```

## 网关 HTTP

信封：`{ success, code, message, data }`。写操作带登录 JWT 或 `x-upload-key`。

- `POST /upload` 同步上传，字段 `file`，可选 `prefix` / `filename` / `contentType`
- `POST /upload/async` 入队，立刻返回 `{ id, status: "queued" }`
- `GET /upload/jobs/:id` 查异步任务
- `DELETE /upload/objects?key=` 删对象
- `GET /upload/health` 探活（含当前驱动是否配置、能否连上）

`UPLOAD_DRIVER` 只选存储厂商：`minio` / `oss` / `cos`。密钥全部走环境变量。
