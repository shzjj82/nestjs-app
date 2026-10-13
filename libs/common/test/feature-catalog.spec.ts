import {
  ADMIN_ONLY_PERMISSION_CODES,
  DEFAULT_FEATURE_CATALOG,
  uncoveredBusinessApiKeys,
  platformApisByPermissionCode,
} from '../src/feature-catalog';
import { PERMISSIONS } from '../src/types';

describe('feature catalog', () => {
  it('covers every business gateway route', () => {
    expect(uncoveredBusinessApiKeys()).toEqual([]);
  });

  it('binds platform permissions to gateway routes', () => {
    const map = platformApisByPermissionCode();
    expect(map.get(PERMISSIONS.USER_QUERY)).toEqual(
      expect.arrayContaining(['GET /users', 'GET /users/:id']),
    );
    expect(map.get(PERMISSIONS.BUSINESS_MANAGE)?.length).toBeGreaterThan(0);
  });

  it('keeps unique feature codes', () => {
    const codes = DEFAULT_FEATURE_CATALOG.map((item) => item.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('gives every feature at least one api when declared in catalog builders', () => {
    const empty = DEFAULT_FEATURE_CATALOG.filter((item) => item.apis.length === 0);
    expect(empty.map((item) => item.code)).toEqual([]);
  });

  it('marks permission catalog as admin-only', () => {
    expect(ADMIN_ONLY_PERMISSION_CODES.has(PERMISSIONS.PERMISSION_MANAGE)).toBe(true);
    expect(ADMIN_ONLY_PERMISSION_CODES.has(PERMISSIONS.PERMISSION_IMPORT)).toBe(true);
    expect(ADMIN_ONLY_PERMISSION_CODES.has(PERMISSIONS.USER_QUERY)).toBe(false);
  });
});
