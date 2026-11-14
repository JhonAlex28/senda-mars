import { useMemo } from 'react';
import { useAsync } from '@/shared/hooks/useAsync';
import type { BBox } from '@/shared/types/geo';
import { terrainApi } from '../api/terrainApi';
import { renderTerrain } from '../lib/renderTerrain';
import type { TerrainGrid } from '../types';

export interface TerrainLayer {
  grid: TerrainGrid;
  image: string; // data URL lista para dibujar
}

/** Descarga la grilla y la convierte en imagen sombreada. bbox = null → no se pide nada. */
export function useTerrain(cellSizeM: number, bbox?: BBox | null) {
  const key = bbox === undefined ? 'site' : bbox ? Object.values(bbox).map((v) => v.toFixed(5)).join(',') : 'none';
  const { data, error, loading } = useAsync<TerrainGrid | null>(
    () => (bbox === null ? Promise.resolve(null) : terrainApi.get(cellSizeM, bbox)),
    [cellSizeM, key],
  );
  const layer = useMemo<TerrainLayer | null>(() => (data ? { grid: data, image: renderTerrain(data) } : null), [data]);
  return { layer, error, loading };
}
