/** 地球平均半径（米） */
const EARTH_RADIUS_M = 6_371_000;

/** 度 → 弧度 */
function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * 两点球面距离（Haversine，米）。
 * 坐标系按门店入库的 GCJ-02 / 小程序定位原样计算，不做坐标转换。
 */
export function distanceMeters(
  lng1: number,
  lat1: number,
  lng2: number,
  lat2: number,
): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function isValidLngLat(lng: number, lat: number): boolean {
  return (
    Number.isFinite(lng) &&
    Number.isFinite(lat) &&
    lng >= -180 &&
    lng <= 180 &&
    lat >= -90 &&
    lat <= 90
  );
}
