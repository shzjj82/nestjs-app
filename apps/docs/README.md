# docs

文档微服务：只负责文档和分类的存储、查询。文件上传、账号、其它能力不在这里。

调用方通过网关 HTTP 读写；本进程只订阅 MQTT。

## 目录

```
src/
  main.ts                 启动 MQTT 微服务
  docs.module.ts          组装各领域模块
  docs.controller.ts      健康检查
  common/                 RPC 工具、编辑器/标签类型、拦截器
  entities/               doc_documents / doc_categories
  database/               TypeORM 连接与启动种子
  documents/              文档：树 + 每个 appCode 一篇 about
  categories/             分类 CRUD，改 slug 时同步文档
  site/                   关于卡投影（读同一篇 about 文档，无独立表）
```

## 网关 HTTP

信封：`{ success, code, message, data }`。写操作带登录 JWT 或 `x-docs-key`。`/docs/documents` 与 `/docs/posts` 同一套接口。

公开读：

- `GET /docs/health`
- `GET /docs/posts` 或 `/docs/documents` 已发布列表（`tree` / `includeDrafts` 需登录或 key）
- `GET /docs/posts/:slug` 前台按 slug 打开
- `GET /docs/categories`
- `GET /docs/site`

需登录或 key：

- `GET /docs/posts/workspace/specials`
- `GET /docs/posts/id/:id`
- `POST /docs/posts`
- `PUT /docs/posts/:id`
- `DELETE /docs/posts/:id`
- `POST /docs/posts/id/:id/children`
- `PUT /docs/posts/id/:id/parent`
- 分类 / 站点的写接口

未带 key 的读请求只返回非草稿，且祖先也不能是草稿。

`appCode` 隔离应用（默认 `blog`），`kind` 只表示文档形态。分类用 `category_id` 关联，slug 同步保存在 `category`。正文带 `body_format`（默认 `editorjs`）。

| 列 | 含义 |
|---|---|
| `app_code` | 应用：blog / kb / … |
| `kind` | 形态：article / about |
| `category` / `category_id` | 该应用下的分类 |

| kind | 说明 | 树 / 草稿 | 额外字段 |
|---|---|---|---|
| `article` | 普通文档 | 可以 | 分类标签 |
| `about` | 每个 appCode 一篇 | 否 | `props.avatar` / `props.skills` |

查询都带 `appCode`。`GET/PUT /docs/site` 仍是该应用 about 文档的投影。可选独立库：`DOCS_DATABASE_URL`。

## 本地

```bash
pnpm start:docs
# 另开终端
pnpm start:gateway
```

```bash
curl http://127.0.0.1:3000/docs/documents?appCode=blog
curl -H "x-docs-key: dev-docs-key" http://127.0.0.1:3000/docs/documents?tree=1&appCode=blog
```
