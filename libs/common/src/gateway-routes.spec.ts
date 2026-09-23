import { matchRoute } from './gateway-routes';

describe('matchRoute', () => {
  it('matches public list route', () => {
    const route = matchRoute('GET', '/users');
    expect(route?.pattern).toBe('user.findAll');
    expect(route?.override).toBeUndefined();
  });

  it('extracts path params', () => {
    const route = matchRoute('GET', '/users/u-1');
    expect(route?.pattern).toBe('user.findOne');
    expect(route?.params).toEqual({ id: 'u-1' });
  });

  it('marks create user as jwt-protected', () => {
    const route = matchRoute('POST', '/users');
    expect(route?.auth).toEqual(['jwt']);
    expect(route?.override).toBeUndefined();
  });

  it('marks create order as override', () => {
    const route = matchRoute('POST', '/orders');
    expect(route?.override).toBe(true);
  });

  it('returns null for unknown paths', () => {
    expect(matchRoute('GET', '/unknown')).toBeNull();
  });
});
