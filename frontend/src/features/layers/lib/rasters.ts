import type { Raster } from '@/features/map';
import type { TerrainLayer } from '@/features/terrain';
import type { LayerId } from '../catalog';
import type { LayerView } from '../state/LayersContext';

/**
 * Imágenes del terreno según las capas activas: primero todos los relieves (el detalle encima del
 * sitio) y luego las pendientes. Las capas ópticas y temáticas (foto orbital, minerales, refugio)
 * llegarán con datos oficiales de la NASA; hasta entonces están bloqueadas en el catálogo.
 */
export function terrainRasters(terrains: (TerrainLayer | null)[], layers: Record<LayerId, LayerView>): Raster[] {
  const present = terrains.filter((t): t is TerrainLayer => !!t);
  const pass = (id: 'relief' | 'slope') =>
    layers[id].visible
      ? present.map((t, i) => ({ key: `${id}-${i}`, image: t[id], bbox: t.grid.bbox, opacity: layers[id].opacity }))
      : [];
  return [...pass('relief'), ...pass('slope')];
}
