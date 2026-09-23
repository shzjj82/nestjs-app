import { Workbook } from 'exceljs';

const YES = new Set(['是', 'Y', 'y', '1', 'true', 'TRUE', '√', 'x', 'X']);

export interface PermissionRow {
  module: string;
  code: string;
  name: string;
  description: string | null;
  sort: number;
}

export interface RoleCheckRow {
  permissionCode: string;
  roleCode: string;
  enabled: boolean;
}

export async function parsePermissionWorkbook(buffer: Buffer): Promise<{
  permissions: PermissionRow[];
  checks: RoleCheckRow[];
}> {
  const workbook = new Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  const sheet = workbook.getWorksheet('功能点') ?? workbook.worksheets[0];
  if (!sheet) {
    return { permissions: [], checks: [] };
  }

  const permissions: PermissionRow[] = [];
  sheet.eachRow((row, index) => {
    if (index === 1) {
      return;
    }
    const module = cellText(row.getCell(1)) || '默认';
    const code = cellText(row.getCell(2));
    const name = cellText(row.getCell(3));
    if (!code || !name) {
      return;
    }
    permissions.push({
      module,
      code,
      name,
      description: cellText(row.getCell(4)) || null,
      sort: Number(row.getCell(5).value) || 0,
    });
  });

  const checks: RoleCheckRow[] = [];
  const matrix = workbook.getWorksheet('角色勾选');
  if (matrix) {
    const header = matrix.getRow(1);
    const roleNames: string[] = [];
    header.eachCell((cell, col) => {
      if (col >= 3) {
        roleNames[col] = cellText(cell);
      }
    });
    matrix.eachRow((row, index) => {
      if (index === 1) {
        return;
      }
      const permissionCode = cellText(row.getCell(1));
      if (!permissionCode) {
        return;
      }
      roleNames.forEach((roleName, col) => {
        if (!roleName) {
          return;
        }
        checks.push({
          permissionCode,
          roleCode: roleName,
          enabled: YES.has(cellText(row.getCell(col))),
        });
      });
    });
  }

  return { permissions, checks };
}

function cellText(cell: { value?: unknown }): string {
  const value = cell?.value;
  if (value == null) {
    return '';
  }
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value).trim();
  }
  if (typeof value === 'object' && value && 'text' in value) {
    return String((value as { text: string }).text).trim();
  }
  return String(value).trim();
}
