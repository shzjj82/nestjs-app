import type { BusinessRegistryEntry } from '@app/common';
import { evaluateBizAccess } from './biz-access';

const blog: BusinessRegistryEntry = {
  code: 'blog',
  status: 1,
  apis: ['GET /docs/documents'],
};
const docsRoute = {
  scope: 'business' as const,
  method: 'GET' as const,
  path: '/docs/documents',
};

describe('evaluateBizAccess', () => {
  it('rejects business route without header', () => {
    const result = evaluateBizAccess({ route: docsRoute, headerCode: null, entry: undefined, session: null });
    expect(result).toMatchObject({ ok: false, status: 400 });
  });

  it('rejects unknown or disabled business', () => {
    expect(
      evaluateBizAccess({ route: docsRoute, headerCode: 'nope', entry: undefined, session: null }),
    ).toMatchObject({ ok: false, status: 403 });
    expect(
      evaluateBizAccess({
        route: docsRoute,
        headerCode: 'blog',
        entry: { ...blog, status: 0 },
        session: null,
      }),
    ).toMatchObject({ ok: false, status: 403 });
  });

  it('allows anonymous access to an enabled api', () => {
    expect(
      evaluateBizAccess({ route: docsRoute, headerCode: 'blog', entry: blog, session: null }),
    ).toEqual({ ok: true, bizCode: 'blog' });
  });

  it('rejects a session from another business', () => {
    expect(
      evaluateBizAccess({
        route: docsRoute,
        headerCode: 'blog',
        entry: blog,
        session: { bizCode: 'wiki', isAdmin: false },
      }),
    ).toMatchObject({ ok: false, status: 403 });
  });

  it('lets platform super admin act on any business', () => {
    expect(
      evaluateBizAccess({
        route: docsRoute,
        headerCode: 'blog',
        entry: blog,
        session: { bizCode: 'platform', isAdmin: true },
      }),
    ).toEqual({ ok: true, bizCode: 'blog' });
  });

  it('rejects apis the business has not enabled, naming the api', () => {
    expect(
      evaluateBizAccess({
        route: { scope: 'business', method: 'POST', path: '/auth/register' },
        headerCode: 'blog',
        entry: blog,
        session: null,
      }),
    ).toEqual({ ok: false, status: 403, message: '业务 blog 未开通接口：POST /auth/register' });
  });

  it('lets the platform business call every business api', () => {
    expect(
      evaluateBizAccess({
        route: { scope: 'business', method: 'POST', path: '/auth/login' },
        headerCode: 'platform',
        entry: { code: 'platform', status: 1, apis: [] },
        session: null,
      }),
    ).toEqual({ ok: true, bizCode: 'platform' });
  });

  it('restricts platform routes to platform sessions', () => {
    expect(
      evaluateBizAccess({
        route: { scope: 'platform' },
        headerCode: null,
        entry: undefined,
        session: { bizCode: 'blog', isAdmin: true },
      }),
    ).toMatchObject({ ok: false, status: 403 });
    expect(
      evaluateBizAccess({
        route: { scope: 'platform' },
        headerCode: null,
        entry: undefined,
        session: { bizCode: 'platform', isAdmin: false },
      }),
    ).toEqual({ ok: true, bizCode: 'platform' });
  });

  it('passes through unscoped routes without blocking', () => {
    expect(
      evaluateBizAccess({ route: {}, headerCode: 'ghost', entry: undefined, session: null }),
    ).toEqual({ ok: true, bizCode: null });
  });
});
