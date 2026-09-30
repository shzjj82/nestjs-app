# agents

智能体微服务：OpenAI 兼容 chat。密钥和环境变量只放在本进程。

`sync` 控制是否流式：默认 `true` 一次返回 `{ reply }`；`false` 时上游 `stream: true`，网关把 SSE 转给前端。图片识别 / 语音合成 / 语音识别只预留目录。

## 目录

```
src/
  main.ts                 MQTT + 内部流式 HTTP
  agents.module.ts        组装 chat / ApiDocs
  agents.controller.ts    健康检查
  chat/                   OpenAI 兼容 chat/completions
  vision/                 后续图片识别
  speech/                 后续语音合成 / 识别
```

## 网关 HTTP

信封：`{ success, code, message, data }`（`sync: false` 时改为 `text/event-stream`）。对话需要登录 JWT，并带 `X-Biz-Code`。

- `GET /agents/health` 探活
- `GET /agents/chat/status` `{ enabled, model }`
- `POST /agents/chat` `sync` 默认 true 等完整 `reply`；`sync: false` 流式 SSE

```bash
curl -X POST http://localhost:3000/agents/chat \
  -H 'X-Biz-Code: blog' \
  -H "Authorization: Bearer <token>" \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"写一句开场白"}]}'

curl -N -X POST http://localhost:3000/agents/chat \
  -H 'X-Biz-Code: blog' \
  -H "Authorization: Bearer <token>" \
  -H 'Content-Type: application/json' \
  -d '{"sync":false,"messages":[{"role":"user","content":"写一句开场白"}]}'
```

环境变量只读 agents 进程：`AI_API_BASE`、`AI_API_KEY`、`AI_MODEL`、`AI_TIMEOUT_MS`。流式 HTTP 默认 `:3006`，网关用 `AGENTS_HTTP_URL` 连接。
