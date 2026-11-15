import type { Hazard } from '@/features/route-planning/types';
import { sampleTerrain } from '@/features/terrain/lib/sample';
import type { TerrainGrid } from '@/features/terrain/types';
import { distanceM } from '@/shared/lib/geo';
import type { GeoPoint } from '@/shared/types/geo';

export interface AStarResult {
  points: GeoPoint[];
  distanceM: number;
  maxSlope: number;
}

/**
 * 8-neighbor grid A* pathfinder over a TerrainGrid.
 * Penalizes steep slopes and avoids hazard circles and impassable slopes (> maxSlopeDeg).
 */
export function computeGridAStar(
  grid: TerrainGrid,
  start: GeoPoint,
  end: GeoPoint,
  hazards: Hazard[] = [],
  options: { gridSize?: number; maxSlopeDeg?: number; slopeWeight?: number } = {},
): AStarResult {
  const N = options.gridSize ?? 48;
  const maxSlopeDeg = options.maxSlopeDeg ?? 22;
  const slopeWeight = options.slopeWeight ?? 1.25;
  const { min_lon, min_lat, max_lon, max_lat } = grid.bbox;
  const dLon = max_lon - min_lon;
  const dLat = max_lat - min_lat;

  const toCell = (p: GeoPoint): [number, number] => {
    const c = Math.max(0, Math.min(N - 1, Math.round(((p.lon - min_lon) / Math.max(1e-7, dLon)) * (N - 1))));
    const r = Math.max(0, Math.min(N - 1, Math.round(((p.lat - min_lat) / Math.max(1e-7, dLat)) * (N - 1))));
    return [r, c];
  };

  const toGeo = (r: number, c: number): GeoPoint => ({
    lon: min_lon + (c / (N - 1)) * dLon,
    lat: min_lat + (r / (N - 1)) * dLat,
  });

  const [sr, sc] = toCell(start);
  const [er, ec] = toCell(end);
  const startIdx = sr * N + sc;
  const endIdx = er * N + ec;

  const total = N * N;
  const gScore = new Float64Array(total).fill(Infinity);
  const fScore = new Float64Array(total).fill(Infinity);
  const cameFrom = new Int32Array(total).fill(-1);
  const closed = new Uint8Array(total);
  const openSet: number[] = [startIdx];

  gScore[startIdx] = 0;
  fScore[startIdx] = Math.hypot(er - sr, ec - sc);

  const dirs = [
    [-1, 0, 1],
    [1, 0, 1],
    [0, -1, 1],
    [0, 1, 1],
    [-1, -1, Math.SQRT2],
    [-1, 1, Math.SQRT2],
    [1, -1, Math.SQRT2],
    [1, 1, Math.SQRT2],
  ];

  while (openSet.length > 0) {
    let bestPos = 0;
    for (let i = 1; i < openSet.length; i++) {
      if (fScore[openSet[i]] < fScore[openSet[bestPos]]) bestPos = i;
    }
    const curr = openSet[bestPos];
    openSet.splice(bestPos, 1);

    if (curr === endIdx) break;
    if (closed[curr]) continue;
    closed[curr] = 1;

    const r = Math.floor(curr / N);
    const c = curr % N;

    for (const [dr, dc, stepCost] of dirs) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0 || nr >= N || nc < 0 || nc >= N) continue;
      const nIdx = nr * N + nc;
      if (closed[nIdx]) continue;

      const geo = toGeo(nr, nc);
      const slope = sampleTerrain(grid, geo)?.slope ?? 4;
      const inHazard = hazards.some((h) => distanceM(geo, h) <= h.radius_m);

      let penalty = 1 + (slope / 12) * slopeWeight;
      if (slope > maxSlopeDeg && nIdx !== endIdx) penalty += 15;
      if (inHazard && nIdx !== endIdx) penalty += 45;

      const tentativeG = gScore[curr] + stepCost * penalty;
      if (tentativeG < gScore[nIdx]) {
        cameFrom[nIdx] = curr;
        gScore[nIdx] = tentativeG;
        fScore[nIdx] = tentativeG + Math.hypot(er - nr, ec - nc);
        if (!openSet.includes(nIdx)) openSet.push(nIdx);
      }
    }
  }

  // Reconstruct path
  const rawCells: number[] = [];
  let cur = endIdx;
  if (cameFrom[cur] === -1 && cur !== startIdx) {
    // Fallback direct line if unreachable
    return {
      points: [start, end],
      distanceM: distanceM(start, end),
      maxSlope: Math.max(sampleTerrain(grid, start)?.slope ?? 4, sampleTerrain(grid, end)?.slope ?? 4),
    };
  }

  while (cur !== -1) {
    rawCells.push(cur);
    if (cur === startIdx) break;
    cur = cameFrom[cur];
  }
  rawCells.reverse();

  const points: GeoPoint[] = rawCells.map((idx, i) => {
    if (i === 0) return start;
    if (i === rawCells.length - 1) return end;
    return toGeo(Math.floor(idx / N), idx % N);
  });

  let dist = 0;
  let maxSlope = 0;
  for (let i = 0; i < points.length; i++) {
    const s = sampleTerrain(grid, points[i])?.slope ?? 4;
    if (s > maxSlope) maxSlope = s;
    if (i > 0) dist += distanceM(points[i - 1], points[i]);
  }

  return { points, distanceM: dist, maxSlope };
}
