import type { BBox } from '@/shared/types/geo';

/** Espejo del DTO TerrainOut. Matrices aplanadas fila a fila, de norte a sur. */
export interface TerrainGrid {
  bbox: BBox;
  rows: number;
  cols: number;
  cell_size_m: number;
  elevation_m: number[];
  slope_deg: number[];
}
