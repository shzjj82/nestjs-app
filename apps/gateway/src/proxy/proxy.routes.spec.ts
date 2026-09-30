import { buildProxyPayload } from './proxy.routes';

describe('buildProxyPayload', () => {
  it('drops client supplied appCode and _bizCode in favour of the verified code', () => {
    const payload = buildProxyPayload(
      { query: { appCode: 'wiki', _bizCode: 'wiki' }, body: { title: 't' } },
      { id: '1' },
      null,
      null,
      'blog',
    );
    expect(payload).not.toHaveProperty('appCode');
    expect(payload._bizCode).toBe('blog');
    expect(payload).toMatchObject({ title: 't', id: '1' });
  });

  it('never trusts client supplied _docsPrivileged', () => {
    const payload = buildProxyPayload({ body: { _docsPrivileged: true } }, {}, null, null, null);
    expect(payload._docsPrivileged).toBe(false);
  });
});
