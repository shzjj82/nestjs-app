export interface RoleGrant {
  code: string;
  permissions: string[];
}

/**
 * 功能点只来自平台级角色（admin 控制台）。
 * 业务角色只表示该 X-Biz-Code 下的身份，不携带功能点。
 */
export function mergeBusinessRbac(input: {
  platformRoles: RoleGrant[];
  businessRoles: RoleGrant[];
}): { roles: string[]; permissions: string[] } {
  const roles = new Set<string>();
  const permissions = new Set<string>();
  for (const role of input.platformRoles) {
    roles.add(role.code);
    role.permissions.forEach((code) => permissions.add(code));
  }
  for (const role of input.businessRoles) {
    roles.add(role.code);
  }
  return { roles: [...roles], permissions: [...permissions] };
}
