import { Injectable } from '@nestjs/common';
import { Workbook } from 'exceljs';
import { requiredString, rpcFail } from '../rpc';
import { parsePermissionWorkbook } from './excel.parser';
import { RbacService } from './rbac.service';

const PERMISSION_HEADERS = ['模块', '功能编码', '功能名称', '描述', '排序'] as const;

@Injectable()
export class ExcelService {
  constructor(private readonly rbac: RbacService) {}

  async exportWorkbook(_payload: Record<string, unknown> = {}) {
    const { roles, permissions, checked } =
      await this.rbac.listRolePermissionMatrix();

    const workbook = new Workbook();
    const sheet = workbook.addWorksheet('功能点');
    sheet.addRow([...PERMISSION_HEADERS]);
    for (const item of permissions) {
      sheet.addRow([
        item.module,
        item.code,
        item.name,
        item.description ?? '',
        item.sort,
      ]);
    }

    const matrix = workbook.addWorksheet('角色勾选');
    matrix.addRow(['功能编码', '功能名称', ...roles.map((role) => role.code)]);
    for (const item of permissions) {
      matrix.addRow([
        item.code,
        item.name,
        ...roles.map((role) =>
          checked.has(`${role.id}:${item.id}`) ? '是' : '否',
        ),
      ]);
    }

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    return {
      filename: 'permissions.xlsx',
      mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      base64: buffer.toString('base64'),
    };
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
      roleChecks: parsed.checks.length,
    };
  }
}
