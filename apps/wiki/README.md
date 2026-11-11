# wiki

编辑器（wiki）专属微服务：文档树、分类、团队、RAG 通知。  
博客仍走 `apps/docs`（`/docs/*`）；本服务对外是 `/wiki/*`。

文档表 `doc_*` 与 docs **共用同一库**（默认 `docs`，靠 `app_code` 区分产品）；团队表 `wiki_teams*` 也落在该库。  
登录仍在 `/auth/*` → usercenter。  
`/wiki/upload`、`/wiki/agents/*`、`/wiki/todos/*`、`/wiki/notifications/*` 由本服务收口后再调平台 upload / agents / notify（可在 `facade/` 加 wiki 业务）。

## 网关 HTTP

写操作带登录 JWT 或 `x-wiki-key`。

- `GET /wiki/health`
- `GET|POST|PUT|DELETE /wiki/documents…`
- `GET|POST|PUT|DELETE /wiki/categories…`

列表 scope：`public` | `feed` | `mine` | `all`。工作区显式传 `scope=mine`。

## 本地

```bash
nest start wiki --watch
# 另开终端
nest start gateway --watch
```

```bash
curl 'http://127.0.0.1:3000/wiki/documents?appCode=wiki&scope=public'
curl -H "Authorization: Bearer <token>" -H "X-Biz-Code: wiki" \
  'http://127.0.0.1:3000/wiki/documents?scope=mine&appCode=wiki'
```
