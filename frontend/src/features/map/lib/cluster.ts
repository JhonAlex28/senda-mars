import type { GeoPoint } from '@/shared/types/geo';
import type { Projection } from './projection';

export interface Cluster<T> {
  items: T[];
  center: GeoPoint;
}

/** Agrupa los puntos que en pantalla quedarían a menos de `minPx` píxeles entre sí. */
export function clusterByScreenDistance<T extends GeoPoint>(
  items: T[],
  projection: Projection,
  unit: number,
  minPx: number,
): Cluster<T>[] {
  const reach = minPx * unit; // en metros del mundo
  const clusters: { items: T[]; x: number; y: number }[] = [];
  for (const item of items) {
    const { x, y } = projection.toXY(item);
    const near = clusters.find((c) => Math.hypot(c.x - x, c.y - y) < reach);
    if (near) {
      near.items.push(item);
      near.x += (x - near.x) / near.items.length;
      near.y += (y - near.y) / near.items.length;
    } else {
      clusters.push({ items: [item], x, y });
    }
  }
  return clusters.map((c) => ({ items: c.items, center: projection.toGeo(c.x, c.y) }));
}
