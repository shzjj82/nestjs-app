# wiki

编辑器（wiki）专属文档微服务：文档树、分类、团队授权、RAG 通知。  
博客仍走 `apps/docs`（`/docs/*`）；本服务对外是 `/wiki/*`。

团队 / 待办 / 通知不在这里：分别是 usercenter、notify。

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
