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

  /**
   * 下载模版：第 1 张表留给填写后上传；第 2 张表是当前全量功能点，只作参考，导入时不读。
   */
  async templateWorkbook(_payload: Record<string, unknown> = {}) {
    const live = await this.rbac.listPermissions();
    const reference = live.length
      ? live
      : DEFAULT_FEATURE_CATALOG.filter((item) => !item.adminOnly);

    const workbook = new Workbook();

    const features = workbook.addWorksheet('功能点');
    features.addRow([...FEATURE_HEADERS]);

    const catalog = workbook.addWorksheet('参考功能点');
    catalog.addRow([...FEATURE_HEADERS, '绑定接口']);
    for (const item of reference) {
      const apiCell = catalog.addRow([
        SCOPE_LABEL[item.scope] ?? '角色权限',
        item.module,
        item.code,
        item.name,
        item.description ?? '',
        item.sort,
        (item.apis ?? []).join('\n'),
      ]).getCell(7);
      apiCell.alignment = { wrapText: true, vertical: 'top' };
    }

    const apis = workbook.addWorksheet('接口绑定');
    apis.addRow([...API_HEADERS]);

    const matrix = workbook.addWorksheet('角色勾选');
    matrix.addRow(['功能编码', '功能名称']);

    this.addGuideSheet(workbook);
    this.autosize(features);
    this.autosize(catalog);
    this.autosize(apis);
    this.autosize(matrix);

    return this.toFile(workbook, 'permissions-template.xlsx');
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
      ['功能点', '第 1 张表。填写后上传；只导入这张表里的行'],
      ['参考功能点', '第 2 张表。当前全量功能点，只作对照，上传时不读取'],
      ['接口绑定', '可选。一个功能编码可对应多行接口（方法 + 路径）'],
      ['角色勾选', '可选。仅「角色权限」用途：从第 3 列起按角色填写「是/否」'],
      [''],
      ['用途取值', '角色权限 = 在「角色」页勾选；开通模块 = 在「业务」页开通'],
      ['接口键', '写入库后为「METHOD 路径」，如 GET /users'],
      ['更新方式', '下载模版，在「功能点」表填写要新增或修改的行，再上传'],
      ['注意', '不要把「参考功能点」整表复制进去，除非确实要按那些行更新'],
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
