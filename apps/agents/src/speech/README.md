# speech / video / language

语音、视频、语言三条链都在 agents 内实现。业务服务（如 medical）只通过 `AgentsClient` 调用，不要再直连通义 ASR / 听悟。

- 短录音：`POST /agents/speech/transcribe`，body 带 `audioBase64`，走 `qwen3-asr-flash` 同步返回 `{ transcript }`
- 长音频 / 视频：同一接口传 `fileUrl`，或 `POST /agents/video/submit`，创建通义听悟 offline 任务，返回 `{ jobId }`
- 查任务：`GET /agents/media/jobs/:id`
- 语言抽取：`POST /agents/language/extract`，调用方传入 `system` / `user`，返回 JSON
