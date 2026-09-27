# docs

文档微服务：只负责文档和分类的存储、查询。文件上传、账号、站点品牌不在这里。

调用方通过网关 HTTP 读写；本进程只订阅 MQTT。

## 目录

```
src/
  main.ts                 启动 MQTT 微服务
  docs.module.ts          组装各领域模块
  docs.controller.ts      健康检查
  common/                 文档侧 RPC 封装、编辑器/标签类型
  entities/               doc_documents / doc_categories
  database/               TypeORM 连接与启动种子
  documents/              文档树（visibility: private|public）
  categories/             分类 CRUD，改 slug 时同步文档
```

## 网关 HTTP

信封：`{ success, code, message, data }`。写操作带登录 JWT 或 `x-docs-key`。只提供 `/docs/documents`。

公开读：

- `GET /docs/health`
- `GET /docs/documents`（`scope=public` 仅公开文；登录态详情可读本人私有）
- `GET /docs/documents/:slug`
- `GET /docs/categories`

需登录或 key：

- `GET /docs/documents/id/:id`（工作区）
- `POST /docs/documents`
- `PUT /docs/documents/:id`
- `DELETE /docs/documents/:id`
- `POST /docs/documents/id/:id/children`
- `PUT /docs/documents/id/:id/parent`
- 分类写接口

列表 scope：`public` | `feed` | `mine` | `all`。工作区必须显式传 `scope=mine`（用户 JWT，禁止仅靠 service key）。`tree=1` 只表示树形视图，不再代替 scope。

`appCode` 必填，用来隔离应用。`kind` 目前仅 `article`。分类 slug、色值、导航开关由调用方传入，本服务不设默认产品。

## 本地

```bash
npm run start:docs
# 另开终端
npm run start:gateway
```

```bash
curl 'http://127.0.0.1:3000/docs/documents?appCode=demo&scope=public'
curl -H "Authorization: Bearer <token>" 'http://127.0.0.1:3000/docs/documents?scope=mine&appCode=demo'
```
