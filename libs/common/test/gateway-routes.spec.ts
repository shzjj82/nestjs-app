import { matchRoute } from '../src/gateway-routes';
import { MQTT_PATTERNS } from '../src/patterns';

describe('matchRoute', () => {
  it('matches public login route', () => {
    const route = matchRoute('POST', '/auth/login');
    expect(route?.pattern).toBe(MQTT_PATTERNS.AUTH_LOGIN);
    expect(route?.auth).toBeUndefined();
  });

  it('matches wechat and alipay login routes', () => {
    expect(matchRoute('POST', '/auth/wechat')?.pattern).toBe(
      MQTT_PATTERNS.AUTH_WECHAT,
    );
    expect(matchRoute('POST', '/auth/alipay')?.pattern).toBe(
      MQTT_PATTERNS.AUTH_ALIPAY,
    );
  });

  it('protects bind-phone with jwt', () => {
    const route = matchRoute('POST', '/auth/bind-phone');
    expect(route?.pattern).toBe(MQTT_PATTERNS.AUTH_BIND_PHONE);
    expect(route?.auth).toEqual(['jwt']);
  });

  it('protects change-password with jwt', () => {
    const route = matchRoute('POST', '/auth/change-password');
    expect(route?.pattern).toBe(MQTT_PATTERNS.AUTH_CHANGE_PASSWORD);
    expect(route?.auth).toEqual(['jwt']);
  });

  it('protects client admin routes', () => {
    const route = matchRoute('POST', '/clients');
    expect(route?.pattern).toBe(MQTT_PATTERNS.CLIENT_CREATE);
    expect(route?.auth).toEqual(['jwt']);
    expect(route?.permissions).toEqual(['client.manage']);
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
    expect(matchRoute('POST', '/orders/shares')).toBeNull();
    expect(matchRoute('POST', '/orders/ocr')).toBeNull();
    const route = matchRoute('POST', '/orders');
    expect(route?.override).toBe(true);
  });

  it('returns null for unknown paths', () => {
    expect(matchRoute('GET', '/unknown')).toBeNull();
  });

  it('exposes public docs list and protects writes with docs-key', () => {
    expect(matchRoute('GET', '/docs/posts')).toBeNull();
    expect(matchRoute('GET', '/docs/documents')?.auth).toBeUndefined();
    expect(matchRoute('GET', '/docs/documents/hello-slug')?.pattern).toBe(
      MQTT_PATTERNS.DOC_POST_FIND_SLUG,
    );
    expect(matchRoute('POST', '/docs/documents')?.auth).toEqual(['jwt', 'docs-key']);
    expect(matchRoute('GET', '/docs/documents/id/abc')?.auth).toEqual([
      'jwt',
      'docs-key',
    ]);
    expect(matchRoute('GET', '/docs/documents')?.pattern).toBe(
      MQTT_PATTERNS.DOC_POST_FIND_ALL,
    );
    expect(matchRoute('POST', '/docs/documents')?.auth).toEqual(['jwt', 'docs-key']);
    expect(matchRoute('GET', '/docs/categories')?.auth).toBeUndefined();
    expect(matchRoute('PUT', '/docs/categories/abc')?.auth).toEqual(['jwt', 'docs-key']);
  });

  it('registers team routes for the signed-in account', () => {
    expect(matchRoute('POST', '/teams')?.pattern).toBe(MQTT_PATTERNS.TEAM_CREATE);
    expect(matchRoute('POST', '/teams/join')?.pattern).toBe(MQTT_PATTERNS.TEAM_JOIN);
    expect(matchRoute('POST', '/teams/team-1/code')?.pattern).toBe(MQTT_PATTERNS.TEAM_REFRESH_CODE);
    expect(matchRoute('PATCH', '/teams/team-1/members/acc-1')?.params).toEqual({
      id: 'team-1',
      accountId: 'acc-1',
    });
  });

  it('protects upload writes with upload-key and marks file posts as override', () => {
    expect(matchRoute('POST', '/upload')?.override).toBe(true);
    expect(matchRoute('POST', '/upload')?.auth).toEqual(['jwt', 'upload-key']);
    expect(matchRoute('POST', '/upload/async')?.pattern).toBe(
      MQTT_PATTERNS.UPLOAD_ENQUEUE,
    );
    expect(matchRoute('GET', '/upload/health')?.auth).toBeUndefined();
    expect(matchRoute('GET', '/upload/jobs/job-1')?.params).toEqual({
      id: 'job-1',
    });
    expect(matchRoute('DELETE', '/upload/objects')?.auth).toEqual([
      'jwt',
      'upload-key',
    ]);
  });

  it('protects agents chat with jwt and marks the chat post as override', () => {
    expect(matchRoute('GET', '/agents/health')?.auth).toBeUndefined();
    expect(matchRoute('GET', '/agents/chat/status')?.auth).toEqual(['jwt']);
    expect(matchRoute('POST', '/agents/chat')?.override).toBe(true);
    expect(matchRoute('POST', '/agents/chat')?.pattern).toBe(MQTT_PATTERNS.AGENTS_CHAT);
    expect(matchRoute('POST', '/agents/vision')?.override).toBe(true);
    expect(matchRoute('POST', '/agents/vision')?.auth).toEqual(['jwt']);
    expect(matchRoute('POST', '/agents/vision')?.pattern).toBe(MQTT_PATTERNS.AGENTS_VISION_PARSE);
    expect(matchRoute('POST', '/agents/chat/async')).toBeNull();
    expect(matchRoute('GET', '/agents/jobs/job-1')).toBeNull();
  });

  it('protects wechat miniprogram admin and qrcode override', () => {
    expect(matchRoute('GET', '/wechat/miniprograms')?.permissions).toEqual([
      'wechat.manage',
    ]);
    expect(matchRoute('DELETE', '/wechat/miniprograms/mp-1')?.pattern).toBe(
      'wechat.mp.delete',
    );
    expect(matchRoute('POST', '/wechat/qrcode')?.override).toBe(true);
    expect(matchRoute('POST', '/wechat/qrcode')?.permissions).toEqual([
      'wechat.qrcode',
    ]);
  });
});
