import { Workbook } from 'exceljs';
import { parsePermissionWorkbook } from './excel.parser';

describe('parsePermissionWorkbook', () => {
  it('reads function points and role checks', async () => {
    const workbook = new Workbook();
    const sheet = workbook.addWorksheet('功能点');
    sheet.addRow(['模块', '功能编码', '功能名称', '描述', '排序']);
    sheet.addRow(['用户', 'user.query', '查询用户', '查看列表', 10]);
    const matrix = workbook.addWorksheet('角色勾选');
    matrix.addRow(['功能编码', '功能名称', 'user', 'editor']);
    matrix.addRow(['user.query', '查询用户', '是', '否']);
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

    const parsed = await parsePermissionWorkbook(buffer);
    expect(parsed.permissions).toEqual([
      {
        module: '用户',
        code: 'user.query',
        name: '查询用户',
        description: '查看列表',
        sort: 10,
      },
    ]);
    expect(parsed.checks).toEqual([
      { permissionCode: 'user.query', roleCode: 'user', enabled: true },
      { permissionCode: 'user.query', roleCode: 'editor', enabled: false },
    ]);
  });
});
