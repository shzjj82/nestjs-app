export interface RoleGrant {
  code: string;
  permissions: string[];
}

/**
 * 平台级角色与业务身份角色都携带功能点。
 * 业务角色的 code 仍表示该业务下的身份。
 */
export function mergeBusinessRbac(input: {
  platformRoles: RoleGrant[];
  businessRoles: RoleGrant[];
}): { roles: string[]; permissions: string[] } {
  const roles = new Set<string>();
  const permissions = new Set<string>();
  for (const role of [...input.platformRoles, ...input.businessRoles]) {
    roles.add(role.code);
    role.permissions.forEach((code) => permissions.add(code));
  }
  return { roles: [...roles], permissions: [...permissions] };
}
