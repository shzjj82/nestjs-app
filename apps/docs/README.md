# docs

文档微服务。只存文章、分类、关于页，不接管登录 / 上传 / AI / SEO。

Next.js 或博客服务端通过网关 HTTP 调用；本进程只订阅 MQTT。

## 目录

```
src/
  main.ts                 启动 MQTT 微服务
  docs.module.ts          组装各领域模块
  docs.controller.ts      健康检查
  common/                 RPC 工具、编辑器/标签类型、拦截器
  entities/               doc_posts / doc_categories / doc_site
  database/               TypeORM 连接与启动种子
  posts/                  文章树、草稿祖先、slug、建子页、换父
  categories/             分类 CRUD，改 slug 时同步文章
  site/                   about 页读写与 site 镜像
```

## 网关 HTTP

信封：`{ success, code, message, data }`。写操作带 `x-docs-key`（环境变量 `DOCS_SERVICE_KEY`）。

公开读：

- `GET /docs/health`
- `GET /docs/posts` 已发布列表（`tree` / `includeDrafts` 需 key）
- `GET /docs/posts/:slug` 前台按 slug 打开
- `GET /docs/categories`
- `GET /docs/site`

需 key：

- `GET /docs/posts/workspace/specials`
- `GET /docs/posts/id/:id`
- `POST /docs/posts`
- `PUT /docs/posts/:id`
- `DELETE /docs/posts/:id`
- `POST /docs/posts/id/:id/children`
- `PUT /docs/posts/id/:id/parent`
- 分类 / 站点的写接口

未带 key 的读请求只返回非草稿，且祖先也不能是草稿。

## 本地

```bash
pnpm start:docs
# 另开终端
pnpm start:gateway
```

```bash
curl http://127.0.0.1:3000/docs/posts
curl -H "x-docs-key: dev-docs-key" http://127.0.0.1:3000/docs/posts?tree=1
```
