import { distanceMeters, isValidLngLat } from '../../src/stores/geo';

describe('geo', () => {
  it('computes roughly 1km for nearby points', () => {
    // 约 0.009° 纬度 ≈ 1km
    const meters = distanceMeters(116.4, 39.9, 116.4, 39.909);
    expect(meters).toBeGreaterThan(900);
    expect(meters).toBeLessThan(1100);
  });

  it('returns 0 for identical points', () => {
    expect(distanceMeters(120, 30, 120, 30)).toBe(0);
  });

  it('validates lng/lat ranges', () => {
    expect(isValidLngLat(116.4, 39.9)).toBe(true);
    expect(isValidLngLat(200, 39.9)).toBe(false);
    expect(isValidLngLat(116.4, 100)).toBe(false);
  });
});
