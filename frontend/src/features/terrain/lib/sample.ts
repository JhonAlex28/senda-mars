import type { GeoPoint } from '@/shared/types/geo';
import type { TerrainGrid } from '../types';

/** Elevación y pendiente de la celda bajo un punto (null si cae fuera de la grilla). */
export function sampleTerrain(grid: TerrainGrid, p: GeoPoint): { elevation: number; slope: number } | null {
  const { bbox, rows, cols } = grid;
  const col = Math.floor(((p.lon - bbox.min_lon) / (bbox.max_lon - bbox.min_lon)) * cols);
  const row = Math.floor(((bbox.max_lat - p.lat) / (bbox.max_lat - bbox.min_lat)) * rows);
  if (row < 0 || row >= rows || col < 0 || col >= cols) return null;
  const i = row * cols + col;
  return { elevation: grid.elevation_m[i], slope: grid.slope_deg[i] };
}
