import type { TerrainGrid } from '../types';

/** Umbrales de pendiente (env.json terrain_classes). */
export const CAUTION_SLOPE_DEG = 10;
export const DANGER_SLOPE_DEG = 18;

type RGB = [number, number, number];

// Rampa de color marciana: hondonadas oscuras → crestas claras
const PALETTE: RGB[] = [
  [58, 26, 18],
  [104, 44, 24],
  [150, 68, 34],
  [190, 104, 60],
  [222, 158, 110],
];
const CAUTION: RGB = [245, 158, 11];
const DANGER: RGB = [239, 68, 68];

function ramp(t: number): RGB {
  const x = Math.min(Math.max(t, 0), 0.9999) * (PALETTE.length - 1);
  const i = Math.floor(x);
  const f = x - i;
  return PALETTE[i].map((c, k) => c + (PALETTE[i + 1][k] - c) * f) as RGB;
}

function mix(a: RGB, b: RGB, f: number): RGB {
  return a.map((c, k) => c + (b[k] - c) * f) as RGB;
}

/** Sombreado del relieve con luz desde el noroeste (azimut 315°, altura 45°). */
function hillshade(grid: TerrainGrid, r: number, c: number): number {
  const { rows, cols, elevation_m: z, cell_size_m: size } = grid;
  const at = (rr: number, cc: number) =>
    z[Math.min(Math.max(rr, 0), rows - 1) * cols + Math.min(Math.max(cc, 0), cols - 1)];
  const dzdx = (at(r, c + 1) - at(r, c - 1)) / (2 * size);
  const dzdy = (at(r + 1, c) - at(r - 1, c)) / (2 * size);
  const slope = Math.atan(Math.hypot(dzdx, dzdy) * 3); // exageración vertical ×3
  const aspect = Math.atan2(dzdy, -dzdx);
  const zenith = Math.PI / 4;
  const azimuth = (3 * Math.PI) / 4;
  const shade =
    Math.cos(zenith) * Math.cos(slope) + Math.sin(zenith) * Math.sin(slope) * Math.cos(azimuth - aspect);
  return Math.max(0, shade);
}

/** Convierte la grilla en una imagen PNG (data URL) con relieve y zonas de pendiente marcadas. */
export function renderTerrain(grid: TerrainGrid): string {
  const { rows, cols, elevation_m: z, slope_deg: slope } = grid;
  const canvas = document.createElement('canvas');
  canvas.width = cols;
  canvas.height = rows;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Bucle en vez de Math.min(...z): con grillas grandes el spread desborda la pila
  let zMin = Infinity;
  let zMax = -Infinity;
  for (const v of z) {
    if (v < zMin) zMin = v;
    if (v > zMax) zMax = v;
  }
  const zRange = zMax - zMin || 1;
  const img = ctx.createImageData(cols, rows);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      let color = ramp((z[i] - zMin) / zRange);
      const light = 0.45 + 0.75 * hillshade(grid, r, c);
      color = color.map((v) => v * light) as RGB;
      if (slope[i] > DANGER_SLOPE_DEG) color = mix(color, DANGER, 0.55);
      else if (slope[i] > CAUTION_SLOPE_DEG) color = mix(color, CAUTION, 0.3);
      img.data.set([...color.map((v) => Math.min(255, v)), 255], i * 4);
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL();
}
