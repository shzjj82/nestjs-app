import { formatApiKey, type FeatureScope } from '@app/common';
import { Workbook } from 'exceljs';

const YES = new Set(['是', 'Y', 'y', '1', 'true', 'TRUE', '√', 'x', 'X']);
const SCOPE_MAP: Record<string, FeatureScope> = {
  // 新文案
  角色权限: 'platform',
  开通模块: 'business',
  租户开通: 'business',
  后台权限: 'platform',
  // 兼容旧模版
  平台: 'platform',
  platform: 'platform',
  PLATFORM: 'platform',
  业务: 'business',
  business: 'business',
  BUSINESS: 'business',
};

export interface PermissionRow {
  scope: FeatureScope;
  module: string;
  code: string;
  name: string;
  description: string | null;
  sort: number;
  apis: string[];
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

  const byCode = new Map<string, PermissionRow>();
  sheet.eachRow((row, index) => {
    if (index === 1) {
      return;
    }
    const c1 = cellText(row.getCell(1));
    const useLegacy = !SCOPE_MAP[c1];
    const scope = useLegacy ? 'platform' : SCOPE_MAP[c1];
    const module = useLegacy ? c1 || '默认' : cellText(row.getCell(2)) || '默认';
    const code = useLegacy ? cellText(row.getCell(2)) : cellText(row.getCell(3));
    const name = useLegacy ? cellText(row.getCell(3)) : cellText(row.getCell(4));
    if (!code || !name) {
      return;
    }
    const description = useLegacy
      ? cellText(row.getCell(4)) || null
      : cellText(row.getCell(5)) || null;
    const sort = useLegacy
      ? Number(row.getCell(5).value) || 0
      : Number(row.getCell(6).value) || 0;
    byCode.set(code, {
      scope,
      module,
      code,
      name,
      description,
      sort,
      apis: [],
    });
  });

  const apiSheet = workbook.getWorksheet('接口绑定') ?? workbook.getWorksheet('接口');
  if (apiSheet) {
    apiSheet.eachRow((row, index) => {
      if (index === 1) {
        return;
      }
      const permissionCode = cellText(row.getCell(1));
      if (!permissionCode) {
        return;
      }
      const methodOrKey = cellText(row.getCell(2));
      const path = cellText(row.getCell(3));
      const inline = parseInlineApiKey(methodOrKey);
      const key = inline
        ? formatApiKey(inline.method, inline.path)
        : methodOrKey && path
          ? formatApiKey(methodOrKey, path)
          : '';
      if (!key) {
        return;
      }
      const rowItem = byCode.get(permissionCode);
      if (!rowItem) {
        byCode.set(permissionCode, {
          scope: 'business',
          module: '默认',
          code: permissionCode,
          name: permissionCode,
          description: null,
          sort: 0,
          apis: [key],
        });
        return;
      }
      if (!rowItem.apis.includes(key)) {
        rowItem.apis.push(key);
      }
    });
  }

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

  return { permissions: [...byCode.values()], checks };
}

function parseInlineApiKey(value: string): { method: string; path: string } | null {
  const trimmed = value.trim().replace(/\s+/g, ' ');
  const space = trimmed.indexOf(' ');
  if (space <= 0) {
    return null;
  }
  const method = trimmed.slice(0, space).toUpperCase();
  const path = trimmed.slice(space + 1).trim();
  if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method) || !path.startsWith('/')) {
    return null;
  }
  return { method, path };
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
