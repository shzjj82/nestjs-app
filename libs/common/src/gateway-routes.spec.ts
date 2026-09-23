import { matchRoute } from './gateway-routes';
import { MQTT_PATTERNS } from './patterns';

describe('matchRoute', () => {
  it('matches public login route', () => {
    const route = matchRoute('POST', '/auth/login');
    expect(route?.pattern).toBe(MQTT_PATTERNS.AUTH_LOGIN);
    expect(route?.auth).toBeUndefined();
  });

  it('matches wechat login route', () => {
    const route = matchRoute('POST', '/auth/wechat');
    expect(route?.pattern).toBe(MQTT_PATTERNS.AUTH_WECHAT);
  });

  it('matches public refresh route', () => {
    const route = matchRoute('POST', '/auth/refresh');
    expect(route?.pattern).toBe(MQTT_PATTERNS.AUTH_REFRESH);
    expect(route?.auth).toBeUndefined();
  });

  it('extracts path params', () => {
    const route = matchRoute('GET', '/users/u-1');
    expect(route?.pattern).toBe(MQTT_PATTERNS.USER_FIND_ONE);
    expect(route?.params).toEqual({ id: 'u-1' });
  });

  it('protects user list with jwt and permission', () => {
    const route = matchRoute('GET', '/users');
    expect(route?.auth).toEqual(['jwt']);
    expect(route?.permissions).toEqual(['user.query']);
  });

  it('marks permission export as override', () => {
    const route = matchRoute('GET', '/permissions/export');
    expect(route?.override).toBe(true);
    expect(route?.pattern).toBe(MQTT_PATTERNS.PERMISSION_EXPORT);
  });

  it('marks create order as override', () => {
    const route = matchRoute('POST', '/orders');
    expect(route?.override).toBe(true);
  });

  it('returns null for unknown paths', () => {
    expect(matchRoute('GET', '/unknown')).toBeNull();
  });
});
