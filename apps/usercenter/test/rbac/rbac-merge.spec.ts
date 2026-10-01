import { mergeBusinessRbac } from '../../src/rbac/rbac-merge';

describe('mergeBusinessRbac', () => {
  it('keeps platform role permissions regardless of capability', () => {
    const result = mergeBusinessRbac({
      platformRoles: [{ code: 'admin', permissions: ['user.query', 'role.manage'] }],
      businessRoles: [],
      capability: new Set(),
    });
    expect(result.roles).toEqual(['admin']);
    expect(result.permissions.sort()).toEqual(['role.manage', 'user.query']);
  });

  it('intersects business role permissions with capability', () => {
    const result = mergeBusinessRbac({
      platformRoles: [],
      businessRoles: [{ code: 'editor', permissions: ['doc.write', 'user.query'] }],
      capability: new Set(['doc.write']),
    });
    expect(result.roles).toEqual(['editor']);
    expect(result.permissions).toEqual(['doc.write']);
  });

  it('dedupes roles and permissions across sources', () => {
    const result = mergeBusinessRbac({
      platformRoles: [{ code: 'admin', permissions: ['doc.write'] }],
      businessRoles: [
        { code: 'user', permissions: ['doc.write'] },
        { code: 'user', permissions: ['doc.read'] },
      ],
      capability: new Set(['doc.write', 'doc.read']),
    });
    expect(result.roles.sort()).toEqual(['admin', 'user']);
    expect(result.permissions.sort()).toEqual(['doc.read', 'doc.write']);
  });
});
