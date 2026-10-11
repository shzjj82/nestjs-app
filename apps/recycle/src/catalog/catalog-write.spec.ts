import { parseTypeKey, parseNonNegInt } from './catalog-write';

function statusOf(fn: () => unknown): number {
  try {
    fn();
  } catch (err) {
    const error = (
      err as { getError?: () => { status?: number } }
    ).getError?.();
    return Number(error?.status);
  }
  throw new Error('预期抛错但没有抛');
}

describe('catalog-write', () => {
  it('accepts type keys like paper', () => {
    expect(parseTypeKey('Paper')).toBe('paper');
  });

  it('rejects illegal type keys', () => {
    expect(statusOf(() => parseTypeKey('墨盒'))).toBe(400);
    expect(statusOf(() => parseTypeKey('1ink'))).toBe(400);
  });

  it('requires non-negative integer price', () => {
    expect(parseNonNegInt(900, 'price')).toBe(900);
    expect(statusOf(() => parseNonNegInt(-1, 'price'))).toBe(400);
    expect(statusOf(() => parseNonNegInt(1.5, 'price'))).toBe(400);
  });
});
