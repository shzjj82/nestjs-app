# 管理控制台（Next.js + Tailwind + shadcn/ui 风格组件）

超级管理员账号由 **usercenter** 首次启动种子写入（`SEED_ADMIN_USERNAME` / `SEED_ADMIN_PASSWORD`）。本应用只负责登录与管理 UI，不再次注册管理员。

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

打开 http://localhost:3100 ，用超级管理员账号登录。

环境变量：复制 `.env.example` 为 `.env.local`，`GATEWAY_URL` 指向网关（本地 `http://127.0.0.1:3000`，或线上 `https://api.championsea.online`）。`ADMIN_BIZ_CODE` 是后台登录所在的业务，默认 `platform`。

## 业务

后台登录在 `platform` 业务下，所有请求经 `/api/proxy` 转发时自动带 `X-Biz-Code`（默认 `ADMIN_BIZ_CODE`）。需要操作某个业务的数据时，在页面里用 `adminFetch(path, { bizCode })` 覆盖，例如「文档空间」切换业务就是这样发请求的。平台管理员可以跨业务。

- **业务管理**：新建业务、开通模块（文档 / 上传 / 订单）、设置默认角色、启停；每行可打开「能力包」「接入端」「成员」。
- **角色权限组**：顶部选业务。业务角色只能勾选该业务能力包内的功能点；标「平台级」的角色（如 `admin`）在所有业务生效。
- 修改能力包、角色权限或成员角色后，相关用户的 token 会被吊销，需重新登录。

## UI 组件（shadcn / tablecn）

整个后台（不只是表格）统一用 shadcn 组件 + Tailwind 工具类，图标用 `lucide-react`。组件**只允许通过 shadcn CLI 安装**，不要手抄 registry 文件到 `src/components/ui/`，也不要新增自定义 `.css` 文件。

```bash
cd apps/admin

# 官方 UI 组件
npx shadcn@latest add button card field select sidebar breadcrumb -y

# tablecn 数据表格（需已配置 components.json 中的 @tablecn registry）
npx shadcn@latest add @tablecn/data-table @tablecn/data-table-filter-menu @tablecn/data-table-sort-list -y --overwrite
```

业务封装写在 `src/components/admin-*.tsx` 等目录，不要复制一份 shadcn 源码。

## 筛选条件 `FilterBar`

`src/components/filter-bar` 是全局筛选组合组件（tablecn 风格：搜索框 + 虚线分面筛选 + 日期范围 + 重置），与表格解耦，受控使用：

```tsx
import { FilterBar, type FilterField, type FilterValues, filtersToSearchParams } from '@/components/filter-bar';

const fields: FilterField<User>[] = [
  { id: 'keyword', type: 'text', label: '关键词', placeholder: '搜索...' },
  { id: 'status', type: 'multiSelect', label: '状态', options: [{ label: '正常', value: '1' }] },
  { id: 'createdAt', type: 'dateRange', label: '创建时间' },
];

const [values, setValues] = useState<FilterValues>({});
<FilterBar fields={fields} value={values} onChange={setValues} actions={<Button>导出</Button>} />;

// 服务端：keyword=..&status=1&status=0&createdAtFrom=ISO&createdAtTo=ISO
const qs = filtersToSearchParams(values);
// 客户端：filterRows(rows, fields, values)，字段可用 accessor 自定义取值
```

表格直接传 `filters`：`<DataTable filters={fields} />`（客户端分页自动前端过滤；服务端分页用 `onFiltersChange` 拿到已防抖的值去请求接口）。
