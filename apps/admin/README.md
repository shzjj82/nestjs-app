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
