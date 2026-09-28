# 管理控制台（Next.js + Tailwind + shadcn/ui 风格组件）

超级管理员账号由 **usercenter** 首次启动种子写入（`SEED_ADMIN_USERNAME` / `SEED_ADMIN_PASSWORD`，默认 `admin` / `admin123`）。本应用只负责登录与管理 UI，不再次注册管理员。

## 开发

先启动后端（gateway 等）：

```bash
# 仓库根目录
npm run infra:up
npm run start:dev
```

再启动管理后台（端口 **3100**）：

```bash
npm run start:admin
# 或
cd apps/admin && npm run dev
```

打开 http://localhost:3100 ，用 `admin` / `admin123` 登录。

环境变量见 `.env.example`：`GATEWAY_URL` 指向网关。
