import { normalizeAppCode } from './wechat-app-code';

describe('normalizeAppCode', () => {
  it('accepts letter-leading codes', () => {
    expect(normalizeAppCode('mall')).toBe('mall');
    expect(normalizeAppCode('crm-mp')).toBe('crm-mp');
    expect(normalizeAppCode('Shop_01')).toBe('Shop_01');
  });
});
