import { useMemo } from 'react';
import { useAsync } from '@/shared/hooks/useAsync';
import type { BBox } from '@/shared/types/geo';
import { terrainApi } from '../api/terrainApi';
import { renderRelief, renderSlope } from '../lib/renderTerrain';
import type { TerrainGrid } from '../types';

export interface TerrainLayer {
  grid: TerrainGrid;
  relief: string; // data URL: altura + sombreado
  slope: string; // data URL: zonas de pendiente (transparente el resto)
}

/** Descarga la grilla y genera sus imágenes (relieve y pendiente). bbox = null → no se pide nada. */
export function useTerrain(cellSizeM: number, bbox?: BBox | null) {
  const key = bbox === undefined ? 'site' : bbox ? Object.values(bbox).map((v) => v.toFixed(5)).join(',') : 'none';
  const { data, error, loading } = useAsync<TerrainGrid | null>(
    () => (bbox === null ? Promise.resolve(null) : terrainApi.get(cellSizeM, bbox)),
    [cellSizeM, key],
  );
  const layer = useMemo<TerrainLayer | null>(() => (data ? { grid: data, relief: renderRelief(data), slope: renderSlope(data) } : null), [data]);
  return { layer, error, loading };
}
