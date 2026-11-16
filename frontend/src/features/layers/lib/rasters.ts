
import type { Raster } from '@/features/map';
import type { TerrainLayer } from '@/features/terrain';
import type { LayerId } from '../catalog';
import type { LayerView } from '../state/LayersContext';

// Cobertura completa de HiRISE: 9 x 19 km.
const FULL_BBOX = {
  min_lon: 137.326722,
  min_lat: -4.875606,
  max_lon: 137.478558,
  max_lat: -4.555064,
};

export function terrainRasters(
  terrains: (TerrainLayer | null)[],
  layers: Record<LayerId, LayerView>,
): Raster[] {
  const rasters: Raster[] = [];

  // 1. Fotografía orbital HiRISE.
  if (layers.imagery.visible) {
    rasters.push({
      key: 'hirise-full',
      image: '/data/layers/hirise_full.png',
      bbox: FULL_BBOX,
      opacity: layers.imagery.opacity,
    });
  }

  // 2. Elevación regional completa.
  if (layers.relief.visible) {
    rasters.push({
      key: 'elevation-full',
      image: '/data/layers/elevation_full.png',
      bbox: FULL_BBOX,
      opacity: layers.relief.opacity,
    });
  }

  // 3. Relieve local de detalle para EVA.
  const local = terrains[1];

  if (local && layers.relief.visible) {
    rasters.push({
      key: 'relief-local',
      image: local.relief,
      bbox: local.grid.bbox,
      opacity: layers.relief.opacity,
    });
  }

  // 4. Pendiente regional completa.
  if (layers.slope.visible) {
    rasters.push({
      key: 'slope-full',
      image: '/data/layers/slope_full.png',
      bbox: FULL_BBOX,
      opacity: layers.slope.opacity,
    });
  }

  // 5. Pendiente local para EVA.
  if (local && layers.slope.visible) {
    rasters.push({
      key: 'slope-local',
      image: local.slope,
      bbox: local.grid.bbox,
      opacity: layers.slope.opacity,
    });
  }

  return rasters;
}
