import { Injectable } from '@nestjs/common';
import { DEFAULT_FEATURE_CATALOG, parseApiKey } from '@app/common';
import { Workbook, type Worksheet } from 'exceljs';
import { requiredString, rpcFail } from '../rpc';
import { parsePermissionWorkbook } from './excel.parser';
import { RbacService } from './rbac.service';

const FEATURE_HEADERS = ['用途', '模块', '功能编码', '功能名称', '描述', '排序'] as const;
const API_HEADERS = ['功能编码', '方法', '路径', '说明'] as const;

/** Excel「用途」列：角色权限=给后台角色勾选；开通模块=给租户开通 */
const SCOPE_LABEL: Record<'platform' | 'business', string> = {
  platform: '角色权限',
  business: '开通模块',
};

@Injectable()
export class ExcelService {
  constructor(private readonly rbac: RbacService) {}

  /** 空模版：说明 + 表头 + 示例行（含默认目录可选用更新模版） */
  async templateWorkbook(payload: Record<string, unknown> = {}) {
    const filled = payload.filled === true || payload.filled === '1' || payload.filled === 1;
    const workbook = new Workbook();
    this.addGuideSheet(workbook);

    const features = workbook.addWorksheet('功能点');
    features.addRow([...FEATURE_HEADERS]);
    const apis = workbook.addWorksheet('接口绑定');
    apis.addRow([...API_HEADERS]);

    const rows = (filled ? DEFAULT_FEATURE_CATALOG : [
          {
            scope: 'platform' as const,
            module: '用户中心',
            code: 'user.query',
            name: '查询用户',
            description: '示例：角色权限，一个功能点绑定多个接口',
            sort: 10,
            apis: ['GET /users', 'GET /users/:id'],
            adminOnly: false,
          },
          {
            scope: 'business' as const,
            module: '认证',
            code: 'auth.account',
            name: '账号登录会话',
            description: '示例：开通模块，租户开通后可调用绑定接口',
            sort: 10,
            apis: ['POST /auth/login', 'GET /auth/me'],
            adminOnly: false,
          },
        ]).filter((item) => !item.adminOnly);

    for (const item of rows) {
      features.addRow([
        SCOPE_LABEL[item.scope],
        item.module,
        item.code,
        item.name,
        item.description ?? '',
        item.sort,
      ]);
      for (const key of item.apis) {
        const parsed = parseApiKey(key);
        if (!parsed) continue;
        apis.addRow([item.code, parsed.method, parsed.path, '']);
      }
    }

    const matrix = workbook.addWorksheet('角色勾选');
    matrix.addRow(['功能编码', '功能名称', 'admin', 'user']);
    matrix.addRow(['user.query', '查询用户', '是', '是']);

    this.autosize(features);
    this.autosize(apis);
    this.autosize(matrix);

    return this.toFile(workbook, filled ? 'permissions-catalog.xlsx' : 'permissions-template.xlsx');
  }

  async exportWorkbook(_payload: Record<string, unknown> = {}) {
    const { roles, permissions, checked } =
      await this.rbac.listRolePermissionMatrix();

    const workbook = new Workbook();
    this.addGuideSheet(workbook);

    // 仅超管功能点不导出、不进角色勾选
    const visible = permissions.filter((item) => !item.adminOnly);
    const assignRoles = roles.filter((role) => !(role.code === 'admin' && role.businessId === null));

    const sheet = workbook.addWorksheet('功能点');
    sheet.addRow([...FEATURE_HEADERS]);
    for (const item of visible) {
      sheet.addRow([
        SCOPE_LABEL[item.scope] ?? '角色权限',
        item.module,
        item.code,
        item.name,
        item.description ?? '',
        item.sort,
      ]);
    }

    const apis = workbook.addWorksheet('接口绑定');
    apis.addRow([...API_HEADERS]);
    for (const item of visible) {
      for (const key of item.apis ?? []) {
        const parsed = parseApiKey(key);
        if (!parsed) continue;
        apis.addRow([item.code, parsed.method, parsed.path, '']);
      }
    }

    const platformOnly = visible.filter((item) => item.scope !== 'business');
    const matrix = workbook.addWorksheet('角色勾选');
    matrix.addRow(['功能编码', '功能名称', ...assignRoles.map((role) => role.code)]);
    for (const item of platformOnly) {
      matrix.addRow([
        item.code,
        item.name,
        ...assignRoles.map((role) =>
          checked.has(`${role.id}:${item.id}`) ? '是' : '否',
        ),
      ]);
    }

    this.autosize(sheet);
    this.autosize(apis);
    this.autosize(matrix);

    return this.toFile(workbook, 'permissions.xlsx');
  }

  async importWorkbook(payload: Record<string, unknown>) {
    const base64 = requiredString(payload.base64, 'file');
    const buffer = Buffer.from(base64, 'base64');
    const parsed = await parsePermissionWorkbook(buffer);
    if (!parsed.permissions.length) {
      rpcFail(400, 'Excel 中没有有效的功能点');
    }
    await this.rbac.upsertPermissions(parsed.permissions);
    if (parsed.checks.length) {
      await this.rbac.applyRoleChecks(parsed.checks);
    }
    return {
      imported: parsed.permissions.length,
      apiBindings: parsed.permissions.reduce((n, p) => n + p.apis.length, 0),
      roleChecks: parsed.checks.length,
    };
  }

  private addGuideSheet(workbook: Workbook) {
    const guide = workbook.addWorksheet('说明');
    const lines = [
      ['功能点 Excel 格式说明'],
      [''],
      ['工作表', '用途'],
      ['功能点', '定义功能点本身：用途 / 模块 / 编码 / 名称 / 描述 / 排序'],
      ['接口绑定', '一个功能编码可对应多行接口（方法 + 路径）'],
      ['角色勾选', '仅「角色权限」用途：按角色填写「是/否」'],
      [''],
      ['用途取值', '角色权限 = 在「角色」页勾选；开通模块 = 在「业务」页开通'],
      ['接口键', '写入库后为「METHOD 路径」，如 GET /users'],
      ['更新方式', '下载模版填写 → 导入；或导出当前目录修改后再导入'],
      ['注意', '角色勾选不含超级管理员列；仅超管功能点不导出、不可分配'],
      ['仅超管', '功能点目录的查询/管理/导入/导出仅超级管理员拥有，界面不展示'],
    ];
    for (const row of lines) {
      guide.addRow(row);
    }
    guide.getColumn(1).width = 16;
    guide.getColumn(2).width = 64;
  }

  private autosize(sheet: Worksheet) {
    sheet.columns.forEach((col) => {
      let max = 10;
      col.eachCell?.({ includeEmpty: false }, (cell) => {
        const len = String(cell.value ?? '').length;
        if (len > max) max = Math.min(len + 2, 48);
      });
      col.width = max;
    });
  }

  private async toFile(workbook: Workbook, filename: string) {
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    return {
      filename,
      mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      base64: buffer.toString('base64'),
    };
  }
}
