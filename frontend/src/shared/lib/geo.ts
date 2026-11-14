import type { BBox, GeoPoint } from '@/shared/types/geo';

const MARS_RADIUS_M = 3_389_500;
export const METERS_PER_DEG_LAT = (Math.PI * MARS_RADIUS_M) / 180;

export function metersPerDegLon(lat: number): number {
  return METERS_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);
}

/** Distancia aproximada en metros (suficiente a escala de pocos kilómetros). */
export function distanceM(a: GeoPoint, b: GeoPoint): number {
  const dx = (b.lon - a.lon) * metersPerDegLon((a.lat + b.lat) / 2);
  const dy = (b.lat - a.lat) * METERS_PER_DEG_LAT;
  return Math.hypot(dx, dy);
}

/** Rumbo en grados (0 = norte, 90 = este). */
export function bearingDeg(a: GeoPoint, b: GeoPoint): number {
  const dx = (b.lon - a.lon) * metersPerDegLon((a.lat + b.lat) / 2);
  const dy = (b.lat - a.lat) * METERS_PER_DEG_LAT;
  return ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360;
}

export function lerpPoint(a: GeoPoint, b: GeoPoint, f: number): GeoPoint {
  return { lon: a.lon + (b.lon - a.lon) * f, lat: a.lat + (b.lat - a.lat) * f };
}

/** Caja que contiene los puntos, ampliada marginM por cada lado. */
export function bboxAround(points: GeoPoint[], marginM: number): BBox {
  const lons = points.map((p) => p.lon);
  const lats = points.map((p) => p.lat);
  const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const dLon = marginM / metersPerDegLon(midLat);
  const dLat = marginM / METERS_PER_DEG_LAT;
  return {
    min_lon: Math.min(...lons) - dLon,
    min_lat: Math.min(...lats) - dLat,
    max_lon: Math.max(...lons) + dLon,
    max_lat: Math.max(...lats) + dLat,
  };
}

export function formatLat(lat: number): string {
  return `${Math.abs(lat).toFixed(4)}°${lat < 0 ? 'S' : 'N'}`;
}

export function formatLon(lon: number): string {
  return `${Math.abs(lon).toFixed(4)}°${lon < 0 ? 'W' : 'E'}`;
}
