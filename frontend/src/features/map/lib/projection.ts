import { METERS_PER_DEG_LAT, metersPerDegLon } from '@/shared/lib/geo';
import type { BBox, GeoPoint } from '@/shared/types/geo';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Proyección equirectangular local: 1 unidad del SVG = 1 metro, origen en la esquina NO del sitio. */
export interface Projection {
  width: number;
  height: number;
  toXY: (p: GeoPoint) => { x: number; y: number };
  toGeo: (x: number, y: number) => GeoPoint;
  rectOf: (bbox: BBox) => Rect;
}

export function createProjection(site: BBox): Projection {
  const mLon = metersPerDegLon((site.min_lat + site.max_lat) / 2);
  const toXY = (p: GeoPoint) => ({
    x: (p.lon - site.min_lon) * mLon,
    y: (site.max_lat - p.lat) * METERS_PER_DEG_LAT,
  });
  return {
    width: (site.max_lon - site.min_lon) * mLon,
    height: (site.max_lat - site.min_lat) * METERS_PER_DEG_LAT,
    toXY,
    toGeo: (x, y) => ({ lon: site.min_lon + x / mLon, lat: site.max_lat - y / METERS_PER_DEG_LAT }),
    rectOf: (b) => {
      const nw = toXY({ lon: b.min_lon, lat: b.max_lat });
      const se = toXY({ lon: b.max_lon, lat: b.min_lat });
      return { x: nw.x, y: nw.y, w: se.x - nw.x, h: se.y - nw.y };
    },
  };
}
