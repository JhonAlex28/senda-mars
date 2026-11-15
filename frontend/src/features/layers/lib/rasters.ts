import type { Raster } from '@/features/map';
import type { TerrainGrid, TerrainLayer } from '@/features/terrain';
import type { LayerId } from '../catalog';
import type { LayerView } from '../state/LayersContext';

interface OverlayImages {
  imagery: string;
  minerals: string;
  shelter: string;
}

const overlayCache = new WeakMap<TerrainGrid, OverlayImages>();
const nasaTileTriggered = new WeakSet<TerrainGrid>();

const rasterListeners = new Set<() => void>();

export function subscribeRasterUpdates(listener: () => void): () => void {
  rasterListeners.add(listener);
  return () => rasterListeners.delete(listener);
}

function notifyRasterUpdated() {
  for (const listener of rasterListeners) listener();
}

function drawGeoreferencedWmtsLayer(
  grid: TerrainGrid,
  layer: string,
  z: number,
  ext: 'png' | 'jpg',
  options: {
    alpha?: number;
    composite?: GlobalCompositeOperation;
    onAllFailed?: () => void;
    onDrawn: (dataUrl: string) => void;
    baseCanvas?: HTMLCanvasElement;
  },
) {
  const { min_lon, max_lon, min_lat, max_lat } = grid.bbox;
  const totalCols = 2 ** (z + 1);
  const totalRows = 2 ** z;
  const lonSpan = max_lon - min_lon;
  const latSpan = max_lat - min_lat;
  if (lonSpan <= 0 || latSpan <= 0) return;

  const colMin = Math.max(0, Math.floor(((min_lon + 180) / 360) * totalCols));
  const colMax = Math.min(totalCols - 1, Math.floor(((max_lon + 180) / 360) * totalCols));
  const rowMin = Math.max(0, Math.floor(((90 - max_lat) / 180) * totalRows));
  const rowMax = Math.min(totalRows - 1, Math.floor(((90 - min_lat) / 180) * totalRows));

  const outCanvas = document.createElement('canvas');
  outCanvas.width = 256;
  outCanvas.height = 256;
  const ctx = outCanvas.getContext('2d');
  if (!ctx) return;

  if (options.baseCanvas) {
    ctx.drawImage(options.baseCanvas, 0, 0, outCanvas.width, outCanvas.height);
  }

  const tiles: { row: number; col: number }[] = [];
  for (let row = rowMin; row <= rowMax; row++) {
    for (let col = colMin; col <= colMax; col++) {
      tiles.push({ row, col });
    }
  }
  if (tiles.length === 0) return;

  let settled = 0;
  let successes = 0;
  const tileLonDeg = 360 / totalCols;
  const tileLatDeg = 180 / totalRows;

  for (const { row, col } of tiles) {
    const url = `https://trek.nasa.gov/tiles/Mars/EQ/${layer}/1.0.0/default/default028mm/${z}/${row}/${col}.${ext}`;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const tMinLon = -180 + col * tileLonDeg;
        const tMaxLon = tMinLon + tileLonDeg;
        const tMaxLat = 90 - row * tileLatDeg;
        const tMinLat = tMaxLat - tileLatDeg;

        const interMinLon = Math.max(min_lon, tMinLon);
        const interMaxLon = Math.min(max_lon, tMaxLon);
        const interMinLat = Math.max(min_lat, tMinLat);
        const interMaxLat = Math.min(max_lat, tMaxLat);

        if (interMaxLon > interMinLon && interMaxLat > interMinLat) {
          const sx = ((interMinLon - tMinLon) / tileLonDeg) * img.width;
          const sy = ((tMaxLat - interMaxLat) / tileLatDeg) * img.height;
          const sw = ((interMaxLon - interMinLon) / tileLonDeg) * img.width;
          const sh = ((interMaxLat - interMinLat) / tileLatDeg) * img.height;

          const dx = ((interMinLon - min_lon) / lonSpan) * outCanvas.width;
          const dy = ((max_lat - interMaxLat) / latSpan) * outCanvas.height;
          const dw = ((interMaxLon - interMinLon) / lonSpan) * outCanvas.width;
          const dh = ((interMaxLat - interMinLat) / latSpan) * outCanvas.height;

          ctx.save();
          if (options.alpha !== undefined) ctx.globalAlpha = options.alpha;
          if (options.composite) ctx.globalCompositeOperation = options.composite;
          ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
          ctx.restore();
          successes++;
        }
      } catch {
        // Ignore CORS canvas taint errors if any proxy strips headers
      } finally {
        settled++;
        if (settled === tiles.length) {
          if (successes > 0) {
            options.onDrawn(outCanvas.toDataURL('image/png'));
            notifyRasterUpdated();
          } else {
            options.onAllFailed?.();
          }
        }
      }
    };
    img.onerror = () => {
      settled++;
      if (settled === tiles.length) {
        if (successes > 0) {
          options.onDrawn(outCanvas.toDataURL('image/png'));
          notifyRasterUpdated();
        } else {
          options.onAllFailed?.();
        }
      }
    };
    img.src = url;
  }
}

function fetchNasaOrbitalLayers(
  grid: TerrainGrid,
  out: OverlayImages,
  canvases: { minerals: HTMLCanvasElement; shelter: HTMLCanvasElement },
) {
  if (nasaTileTriggered.has(grid)) return;
  nasaTileTriggered.add(grid);

  // 1. Imagery: 6 m/px MRO CTX Gale Crater Mosaic (fallback to 232 m/px Viking Color Mosaic)
  drawGeoreferencedWmtsLayer(grid, 'Gale_CTX_BlockAdj_dd', 11, 'png', {
    onDrawn: (dataUrl) => {
      out.imagery = dataUrl;
    },
    onAllFailed: () => {
      drawGeoreferencedWmtsLayer(grid, 'Mars_Viking_MDIM21_ClrMosaic_global_232m', 7, 'jpg', {
        onDrawn: (dataUrl) => {
          out.imagery = dataUrl;
        },
      });
    },
  });

  // 2. Minerals: Blend 100 m/px MO THEMIS-IR Day thermal-inertia mosaic over Mount Sharp strata
  drawGeoreferencedWmtsLayer(grid, 'THEMIS_DayIR_ControlledMosaics_100m_v2_oct2018', 9, 'png', {
    baseCanvas: canvases.minerals,
    alpha: 0.38,
    composite: 'soft-light',
    onDrawn: (dataUrl) => {
      out.minerals = dataUrl;
    },
  });

  // 3. Shelter: Shade radiation shelter pockets with 200 m/px MGS MOLA + Mars Express HRSC Color Hillshade
  drawGeoreferencedWmtsLayer(grid, 'Mars_MOLA_blend200ppx_HRSC_ClrShade_clon0dd_200mpp_lzw', 8, 'jpg', {
    baseCanvas: canvases.shelter,
    alpha: 0.35,
    composite: 'source-atop',
    onDrawn: (dataUrl) => {
      out.shelter = dataUrl;
    },
  });
}

function buildOverlayCanvas(
  grid: TerrainGrid,
  paint: (i: number, data: Uint8ClampedArray, p: number) => void,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = grid.cols;
  canvas.height = grid.rows;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  const img = ctx.createImageData(grid.cols, grid.rows);
  const d = img.data;
  for (let i = 0; i < grid.elevation_m.length; i++) {
    paint(i, d, i * 4);
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

function getDerivedOverlays(grid: TerrainGrid): OverlayImages {
  const cached = overlayCache.get(grid);
  if (cached) return cached;

  const { elevation_m, slope_deg } = grid;
  let minE = Infinity;
  let maxE = -Infinity;
  for (let i = 0; i < elevation_m.length; i++) {
    const e = elevation_m[i];
    if (e < minE) minE = e;
    if (e > maxE) maxE = e;
  }
  const spanE = Math.max(1, maxE - minE);

  const imageryCanvas = buildOverlayCanvas(grid, (i, d, p) => {
    const norm = (elevation_m[i] - minE) / spanE;
    const shade = Math.max(0.42, 1 - slope_deg[i] / 38);
    d[p] = Math.min(255, Math.round((138 + norm * 52) * shade));
    d[p + 1] = Math.min(255, Math.round((84 + norm * 36) * shade));
    d[p + 2] = Math.min(255, Math.round((62 + norm * 24) * shade));
    d[p + 3] = 225;
  });

  // Mount Sharp stratigraphic units calibrated to Gale Crater MOLA elevations:
  // Murray mudstone (<-3685 m), Glen Torridon clay (-3685..-3645 m), Stimson sandstone (-3645..-3618 m), Sulfate boxwork (>=-3618 m)
  const mineralsCanvas = buildOverlayCanvas(grid, (i, d, p) => {
    const e = elevation_m[i];
    if (e < -3685) {
      // Murray Formation lacustrine mudstone
      d[p] = 79; d[p + 1] = 195; d[p + 2] = 247; d[p + 3] = 125;
    } else if (e < -3645) {
      // Glen Torridon phyllosilicate clay-bearing trough
      d[p] = 45; d[p + 1] = 212; d[p + 2] = 191; d[p + 3] = 135;
    } else if (e < -3618) {
      // Stimson Formation cross-bedded aeolian sandstone
      d[p] = 245; d[p + 1] = 158; d[p + 2] = 11; d[p + 3] = 120;
    } else {
      // Sulfate-bearing unit & boxwork ridges
      d[p] = 163; d[p + 1] = 113; d[p + 2] = 247; d[p + 3] = 145;
    }
  });

  // Curiosity RAD GCR shielding pockets: steep crater walls / ridge leeward slopes (>7 deg) below upper ridge crest
  const shelterCanvas = buildOverlayCanvas(grid, (i, d, p) => {
    const norm = (elevation_m[i] - minE) / spanE;
    const slope = slope_deg[i];
    if (slope > 7 && norm < 0.65) {
      d[p] = 124; d[p + 1] = 217; d[p + 2] = 146; d[p + 3] = 155;
    } else {
      d[p + 3] = 0;
    }
  });

  const out: OverlayImages = {
    imagery: imageryCanvas.toDataURL('image/png'),
    minerals: mineralsCanvas.toDataURL('image/png'),
    shelter: shelterCanvas.toDataURL('image/png'),
  };
  overlayCache.set(grid, out);
  fetchNasaOrbitalLayers(grid, out, { minerals: mineralsCanvas, shelter: shelterCanvas });
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
