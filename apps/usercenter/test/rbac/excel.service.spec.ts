import { Workbook } from 'exceljs';
import { parsePermissionWorkbook } from '../../src/rbac/excel.parser';

describe('parsePermissionWorkbook', () => {
  it('reads function points, api bindings and role checks', async () => {
    const workbook = new Workbook();
    const sheet = workbook.addWorksheet('功能点');
    sheet.addRow(['用途', '模块', '功能编码', '功能名称', '描述', '排序']);
    sheet.addRow(['角色权限', '用户', 'user.query', '查询用户', '查看列表', 10]);
    sheet.addRow(['开通模块', '认证', 'auth.account', '账号登录', '登录会话', 20]);

    const apis = workbook.addWorksheet('接口绑定');
    apis.addRow(['功能编码', '方法', '路径', '说明']);
    apis.addRow(['user.query', 'GET', '/users', '列表']);
    apis.addRow(['user.query', 'GET', '/users/:id', '详情']);
    apis.addRow(['auth.account', 'POST', '/auth/login', '']);
    apis.addRow(['auth.account', 'GET /auth/me', '', '']);

    const matrix = workbook.addWorksheet('角色勾选');
    matrix.addRow(['功能编码', '功能名称', 'user', 'editor']);
    matrix.addRow(['user.query', '查询用户', '是', '否']);
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

    const parsed = await parsePermissionWorkbook(buffer);
    expect(parsed.permissions).toEqual(
      expect.arrayContaining([
        {
          scope: 'platform',
          module: '用户',
          code: 'user.query',
          name: '查询用户',
          description: '查看列表',
          sort: 10,
          apis: ['GET /users', 'GET /users/:id'],
        },
        {
          scope: 'business',
          module: '认证',
          code: 'auth.account',
          name: '账号登录',
          description: '登录会话',
          sort: 20,
          apis: ['POST /auth/login', 'GET /auth/me'],
        },
      ]),
    );
    expect(parsed.checks).toEqual([
      { permissionCode: 'user.query', roleCode: 'user', enabled: true },
      { permissionCode: 'user.query', roleCode: 'editor', enabled: false },
    ]);
  });

  it('does not import the reference sheet', async () => {
    const workbook = new Workbook();
    const sheet = workbook.addWorksheet('功能点');
    sheet.addRow(['用途', '模块', '功能编码', '功能名称', '描述', '排序']);
    sheet.addRow(['角色权限', '用户', 'user.query', '查询用户', '查看列表', 10]);

    const reference = workbook.addWorksheet('参考功能点');
    reference.addRow(['用途', '模块', '功能编码', '功能名称', '描述', '排序', '绑定接口']);
    reference.addRow(['开通模块', '认证', 'auth.account', '账号登录', '登录会话', 20, 'POST /auth/login']);

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const parsed = await parsePermissionWorkbook(buffer);
    expect(parsed.permissions.map((item) => item.code)).toEqual(['user.query']);
  });

  it('keeps legacy sheet without scope column', async () => {
    const workbook = new Workbook();
    const sheet = workbook.addWorksheet('功能点');
    sheet.addRow(['模块', '功能编码', '功能名称', '描述', '排序']);
    sheet.addRow(['用户', 'user.query', '查询用户', '查看列表', 10]);
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const parsed = await parsePermissionWorkbook(buffer);
    expect(parsed.permissions).toEqual([
      {
        scope: 'platform',
        module: '用户',
        code: 'user.query',
        name: '查询用户',
        description: '查看列表',
        sort: 10,
        apis: [],
      },
    ]);
  });
});
