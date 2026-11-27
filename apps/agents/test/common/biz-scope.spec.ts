import { requireBizCode } from '../../src/support/biz-code';

describe('requireBizCode', () => {
  it('accepts the gateway-injected business code', () => {
    expect(requireBizCode({ _bizCode: 'blog' })).toBe('blog');
  });

  it('rejects a missing or invalid code', () => {
    expect(() => requireBizCode({})).toThrow();
    expect(() => requireBizCode({ _bizCode: '1bad' })).toThrow();
  });
});
