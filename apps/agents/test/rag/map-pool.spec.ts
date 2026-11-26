import { mapPool } from '../../src/common/map-pool';

describe('mapPool', () => {
  it('keeps result order while overlapping the work', async () => {
    let active = 0;
    let peak = 0;
    const out = await mapPool([1, 2, 3, 4, 5], 2, async (item) => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 20));
      active -= 1;
      return item * 10;
    });
    expect(out).toEqual([10, 20, 30, 40, 50]);
    expect(peak).toBeLessThanOrEqual(2);
    expect(peak).toBeGreaterThan(1);
  });
});
