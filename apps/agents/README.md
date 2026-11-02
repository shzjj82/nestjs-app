# agents

智能体微服务：OpenAI 兼容 chat + 文档 RAG。密钥和环境变量只放在本进程。

`sync` 控制是否流式：默认 `true` 一次返回 `{ reply }`；`false` 时上游 `stream: true`，网关把 SSE 转给前端。`rag: true` 时按当前业务与账号可见范围检索 `docs` 索引后增强回答。

## 目录

```
src/
  main.ts                 MQTT + 内部流式 HTTP
  agents.module.ts        组装 chat / rag / vision
  agents.controller.ts    健康检查
  chat/                   OpenAI 兼容 chat/completions
  rag/                    Embedding、分块、pgvector 检索与索引
  vision/                 图片识别
  speech/                 短录音通义 ASR
  video/                  视频/长音频听悟任务
  language/               通用 JSON 抽取
  media/                  听悟任务表与轮询
```

## 网关 HTTP

信封：`{ success, code, message, data }`（`sync: false` 时改为 `text/event-stream`）。对话需要登录 JWT，并带 `X-Biz-Code`。

- `GET /agents/health` 探活
- `GET /agents/chat/status` `{ enabled, model, rag, embeddingModel }`
- `POST /agents/chat` `sync` 默认 true；`rag: true` 做检索增强，返回可选 `sources`
- `POST /agents/rag/search` `{ query, topK?, mineOnly? }` → `{ items }`
- `POST /agents/speech/transcribe` 短录音 `{ audioBase64, mime }` → `{ transcript }`；长音频 `{ fileUrl }` → `{ jobId }`
- `POST /agents/video/submit` `{ fileUrl }` → `{ jobId }`
- `GET /agents/media/jobs/:id` 听悟任务状态
- `POST /agents/language/extract` `{ system, user }` → `{ json, fields }`

```bash
curl -X POST http://localhost:3000/agents/chat \
  -H 'X-Biz-Code: blog' \
  -H "Authorization: Bearer <token>" \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"写一句开场白"}]}'

curl -X POST http://localhost:3000/agents/chat \
  -H 'X-Biz-Code: blog' \
  -H "Authorization: Bearer <token>" \
  -H 'Content-Type: application/json' \
  -d '{"rag":true,"messages":[{"role":"user","content":"根据我的文档总结本周待办"}]}'

curl -X POST http://localhost:3000/agents/rag/search \
  -H 'X-Biz-Code: blog' \
  -H "Authorization: Bearer <token>" \
  -H 'Content-Type: application/json' \
  -d '{"query":"合同付款条件","topK":5}'
```

环境变量（agents 进程）：

| 变量 | 说明 |
|------|------|
| `AI_API_BASE` / `AI_API_KEY` / `AI_MODEL` | Chat 上游（可用 DeepSeek） |
| `AI_EMBEDDING_API_BASE` / `AI_EMBEDDING_API_KEY` | Embedding 上游（可单独配通义；未设则回退 chat 的 base/key） |
| `AI_EMBEDDING_MODEL` | 默认 `text-embedding-3-small`；通义可用 `text-embedding-v4` |
| `AI_EMBEDDING_DIM` | 默认 `1536`，须与表 `ag_rag_chunks.embedding` 一致 |
| `AI_TIMEOUT_MS` | 超时 |
| `AI_ASR_API_BASE` / `AI_ASR_API_KEY` / `AI_ASR_MODEL` | 短语音，默认 `qwen3-asr-flash`；密钥回退 `AI_API_KEY` |
| `TINGWU_APP_KEY` / `ALIBABA_CLOUD_ACCESS_KEY_ID` / `ALIBABA_CLOUD_ACCESS_KEY_SECRET` | 通义听悟离线任务 |
| `TINGWU_REGION` | 默认 `cn-beijing` |
| `AGENTS_DATABASE_URL` | 独立库 `agents`（含 pgvector） |

流式 HTTP 默认 `:3006`，网关用 `AGENTS_HTTP_URL` 连接。

## RAG 说明

- Postgres 镜像需带 **pgvector**（compose 已用 `pgvector/pgvector:pg16`）。已有数据卷需进库执行 `CREATE EXTENSION vector;`，或清卷重建。
- docs 创建/更新/删除后通过 MQTT 通知本服务索引；正文来自 EditorJS，附件（pdf/docx/xlsx 等）从 OSS URL 尽力抽取。
- 文档去掉附件或 upload 删除 OSS 对象时，按 `source_key` 清理对应向量（`agents.rag.deleteBySource`）。
- 检索隔离：`app_code`（=`X-Biz-Code`）+ 公开文 / 本人 `author_id` / 所在团队 `team_id`。
