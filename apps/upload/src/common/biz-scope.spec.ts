import { bizPrefix, keyInBiz, requireBizCode } from './biz-scope';
import { objectKey } from './object-key';

describe('biz-scope', () => {
  it('prefixes object keys with the business code', () => {
    expect(bizPrefix('blog', 'covers')).toBe('blog/covers');
    expect(bizPrefix('blog', '')).toBe('blog');
    expect(objectKey(bizPrefix('blog', '/covers'), 'a.png')).toMatch(/^blog\/covers\/\d{4}\//);
  });

  it('only accepts keys inside the business directory', () => {
    expect(keyInBiz('blog', 'blog/2026/01/01/x.png')).toBe(true);
    expect(keyInBiz('blog', 'wiki/2026/01/01/x.png')).toBe(false);
    expect(keyInBiz('blog', 'blog/../wiki/x.png')).toBe(false);
  });

  it('requires a verified business code', () => {
    expect(requireBizCode({ _bizCode: 'blog' })).toBe('blog');
    expect(() => requireBizCode({})).toThrow();
  });
});
