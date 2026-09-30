export interface RoleGrant {
  code: string;
  permissions: string[];
}

/**
 * 平台级角色（如超级管理员）在所有业务中完整生效；
 * 业务角色的功能点只保留该业务能力包内的部分。
 */
export function mergeBusinessRbac(input: {
  platformRoles: RoleGrant[];
  businessRoles: RoleGrant[];
  capability: Set<string>;
}): { roles: string[]; permissions: string[] } {
  const roles = new Set<string>();
  const permissions = new Set<string>();
  for (const role of input.platformRoles) {
    roles.add(role.code);
    role.permissions.forEach((code) => permissions.add(code));
  }
  for (const role of input.businessRoles) {
    roles.add(role.code);
    role.permissions
      .filter((code) => input.capability.has(code))
      .forEach((code) => permissions.add(code));
  }
  return { roles: [...roles], permissions: [...permissions] };
}
