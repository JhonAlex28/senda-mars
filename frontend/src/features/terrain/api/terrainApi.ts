import { http } from '@/shared/api/httpClient';
import type { BBox } from '@/shared/types/geo';
import type { TerrainGrid } from '../types';

export const terrainApi = {
  /** Todo el sitio, o solo una ventana si se pasa bbox. */
  get: (cellSizeM: number, bbox?: BBox) => {
    const params = new URLSearchParams({ cell_size_m: String(cellSizeM) });
    if (bbox) {
      Object.entries(bbox).forEach(([k, v]) => params.set(k, String(v)));
    }
    return http.get<TerrainGrid>(`/terrain?${params}`);
  },
};
