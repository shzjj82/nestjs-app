import { mergeBusinessRbac } from '../../src/rbac/rbac-merge';

describe('mergeBusinessRbac', () => {
  it('keeps platform role permissions', () => {
    const result = mergeBusinessRbac({
      platformRoles: [{ code: 'admin', permissions: ['user.query', 'role.manage'] }],
      businessRoles: [],
    });
    expect(result.roles).toEqual(['admin']);
    expect(result.permissions.sort()).toEqual(['role.manage', 'user.query']);
  });

  it('keeps permissions granted to business identity roles', () => {
    const result = mergeBusinessRbac({
      platformRoles: [],
      businessRoles: [{ code: 'customer', permissions: ['recycle.order.create'] }],
    });
    expect(result.roles).toEqual(['customer']);
    expect(result.permissions).toEqual(['recycle.order.create']);
  });

  it('dedupes roles across sources', () => {
    const result = mergeBusinessRbac({
      platformRoles: [{ code: 'admin', permissions: ['doc.write'] }],
      businessRoles: [
        { code: 'user', permissions: ['doc.write'] },
        { code: 'user', permissions: ['doc.read'] },
      ],
    });
    expect(result.roles.sort()).toEqual(['admin', 'user']);
    expect(result.permissions.sort()).toEqual(['doc.read', 'doc.write']);
  });
});
