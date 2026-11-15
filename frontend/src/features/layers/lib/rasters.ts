import type { Raster } from '@/features/map';
import type { TerrainGrid, TerrainLayer } from '@/features/terrain';
import type { LayerId } from '../catalog';
import type { LayerView } from '../state/LayersContext';

const overlayCache = new WeakMap<TerrainGrid, { imagery: string; minerals: string; shelter: string }>();
const nasaTileTriggered = new WeakSet<TerrainGrid>();

function fetchNasaOrbitalTile(grid: TerrainGrid, out: { imagery: string; minerals: string; shelter: string }) {
  if (nasaTileTriggered.has(grid)) return;
  nasaTileTriggered.add(grid);
  const z = 7;
  const totalCols = 2 ** (z + 1);
  const totalRows = 2 ** z;
  const lonMid = (grid.bbox.min_lon + grid.bbox.max_lon) * 0.5;
  const latMid = (grid.bbox.min_lat + grid.bbox.max_lat) * 0.5;
  const col = Math.floor(((lonMid + 180) / 360) * totalCols);
  const row = Math.floor(((90 - latMid) / 180) * totalRows);
  const url = `https://trek.nasa.gov/tiles/Mars/EQ/Mars_Viking_MDIM21_ClrMosaic_global_232m/1.0.0/default/default028mm/${z}/${row}/${col}.jpg`;

  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 256;
    const ctx = c.getContext('2d');
    if (ctx) {
      ctx.drawImage(img, 0, 0, 256, 256);
      out.imagery = c.toDataURL('image/png');
    }
  };
  img.src = url;
}

function getDerivedOverlays(grid: TerrainGrid) {
  const cached = overlayCache.get(grid);
  if (cached) {
    fetchNasaOrbitalTile(grid, cached);
    return cached;
  }

  const { rows, cols, elevation_m, slope_deg } = grid;
  const minE = Math.min(...elevation_m);
  const spanE = Math.max(1, Math.max(...elevation_m) - minE);

  const mkCanvas = (paint: (idx: number, data: Uint8ClampedArray, p: number) => void) => {
    const c = document.createElement('canvas');
    c.width = cols;
    c.height = rows;
    const ctx = c.getContext('2d');
    if (ctx) {
      const img = ctx.createImageData(cols, rows);
      for (let i = 0; i < rows * cols; i++) paint(i, img.data, i * 4);
      ctx.putImageData(img, 0, 0);
    }
    return c.toDataURL('image/png');
  };

  const imagery = mkCanvas((i, d, p) => {
    const r = Math.floor(i / cols);
    const c = i % cols;
    const eL = elevation_m[r * cols + Math.max(0, c - 1)];
    const eR = elevation_m[r * cols + Math.min(cols - 1, c + 1)];
    const eU = elevation_m[Math.max(0, r - 1) * cols + c];
    const eD = elevation_m[Math.min(rows - 1, r + 1) * cols + c];
    // NW hillshade illumination
    const shade = Math.max(0.45, Math.min(1.35, 0.92 + (eL - eR) * 0.04 + (eU - eD) * 0.04));
    const norm = (elevation_m[i] - minE) / spanE;
    d[p] = Math.min(255, Math.round((138 + norm * 52) * shade));
    d[p + 1] = Math.min(255, Math.round((84 + norm * 36) * shade));
    d[p + 2] = Math.min(255, Math.round((62 + norm * 24) * shade));
    d[p + 3] = 225;
  });

  const minerals = mkCanvas((i, d, p) => {
    const norm = (elevation_m[i] - minE) / spanE;
    if (norm < 0.35) {
      // Phyllosilicate clay mudstone
      d[p] = 79; d[p + 1] = 195; d[p + 2] = 247; d[p + 3] = 140;
    } else if (norm < 0.68) {
      // Sulfate-bearing boxwork
      d[p] = 163; d[p + 1] = 113; d[p + 2] = 247; d[p + 3] = 135;
    } else {
      d[p + 3] = 0;
    }
  });

  const shelter = mkCanvas((i, d, p) => {
    const norm = (elevation_m[i] - minE) / spanE;
    const slope = slope_deg[i];
    if (slope > 7 && norm < 0.6) {
      // Terrain cliff/crater-wall radiation shielding pocket
      d[p] = 124; d[p + 1] = 217; d[p + 2] = 146; d[p + 3] = 155;
    } else {
      d[p + 3] = 0;
    }
  });

  const out = { imagery, minerals, shelter };
  overlayCache.set(grid, out);
  return out;
}

/**
 * Imágenes del terreno según las capas activas. Primero todos los relieves (el detalle encima del sitio),
 * luego las pendientes y overlays derivados, para que ninguna quede tapada.
 */
export function terrainRasters(terrains: (TerrainLayer | null)[], layers: Record<LayerId, LayerView>): Raster[] {
  const present = terrains.filter((t): t is TerrainLayer => !!t);
  const pass = (id: 'relief' | 'slope') =>
    layers[id].visible
      ? present.map((t, i) => ({ key: `${id}-${i}`, image: t[id], bbox: t.grid.bbox, opacity: layers[id].opacity }))
      : [];
  const derived = (id: 'imagery' | 'minerals' | 'shelter') =>
    layers[id]?.visible
      ? present.map((t, i) => ({
          key: `${id}-${i}`,
          image: getDerivedOverlays(t.grid)[id],
          bbox: t.grid.bbox,
          opacity: layers[id].opacity,
        }))
      : [];
  return [...pass('relief'), ...derived('imagery'), ...pass('slope'), ...derived('minerals'), ...derived('shelter')];
}
