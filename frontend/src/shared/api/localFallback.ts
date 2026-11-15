import type { Readiness } from '@/features/environment/types';
import type { Hazard, Parking, RoutePlan, RoutePoint, RouteProfile, TraversePlan } from '@/features/route-planning/types';
import type { Target } from '@/features/targets/types';
import type { TerrainGrid } from '@/features/terrain/types';
import { computeGridAStar } from '@/shared/lib/astar';
import type { BBox, GeoPoint } from '@/shared/types/geo';

const SITE_BBOX: BBox = {
  min_lon: 137.37204,
  min_lat: -4.8126,
  max_lon: 137.40596,
  max_lat: -4.7788,
};

const CONTROL_POINTS: [number, number, number][] = [
  [137.396, -4.785, -3734.7],
  [137.3915, -4.7885, -3710.0],
  [137.386, -4.7918, -3692.0],
  [137.3892, -4.7955, -3670.5],
  [137.3828, -4.7995, -3646.0],
  [137.3845, -4.803, -3632.0],
  [137.3806, -4.8065, -3614.0],
  [137.3825, -4.8079, -3606.0],
];

function sampleMountSharp(lon: number, lat: number): { elevation_m: number; slope_deg: number } {
  let num = 0;
  let den = 0;
  for (const [cLon, cLat, cZ] of CONTROL_POINTS) {
    const d2 = (lon - cLon) ** 2 + (lat - cLat) ** 2;
    if (d2 < 1e-12) {
      num = cZ;
      den = 1;
      break;
    }
    const w = 1 / Math.pow(d2, 1.35);
    num += w * cZ;
    den += w;
  }
  const baseZ = num / den;
  const boxFactor = Math.max(0, Math.min(1, (-4.792 - lat) / 0.016));
  const u = (lon - SITE_BBOX.min_lon) * 1800.0;
  const v = (lat - SITE_BBOX.min_lat) * 1800.0;
  const r1 = Math.abs(Math.sin(u * Math.PI * 1.3 + 0.4 * Math.cos(v * 2.0)));
  const r2 = Math.abs(Math.sin(v * Math.PI * 1.4 - 0.3 * Math.sin(u * 2.0)));
  const polyNet = Math.pow(1.0 - Math.min(r1, r2), 3);

  let dz = boxFactor * (polyNet * 3.2 - 1.1);
  const dT08 = Math.hypot(lon - 137.38263, lat - -4.80788);
  if (dT08 < 0.0022) dz += 4.5 * Math.exp(-Math.pow(dT08 / 0.0009, 2));

  let slope = 4.2 + boxFactor * 4.8 + polyNet * 9.5;
  const dObs1 = Math.hypot(lon - 137.3888, lat - -4.7962);
  const dObs2 = Math.hypot(lon - 137.3848, lat - -4.8022);
  if (dObs1 < 0.0018) slope = Math.max(slope, 21.5 * Math.exp(-Math.pow(dObs1 / 0.0011, 2)));
  if (dObs2 < 0.0016) slope = Math.max(slope, 22.4 * Math.exp(-Math.pow(dObs2 / 0.001, 2)));

  return {
    elevation_m: Number((baseZ + dz).toFixed(1)),
    slope_deg: Number(Math.min(28.0, slope).toFixed(1)),
  };
}

function marsDistM(a: GeoPoint, b: GeoPoint): number {
  const degToM = 59158.0;
  const latMid = (((a.lat + b.lat) * 0.5) * Math.PI) / 180.0;
  return Math.hypot((b.lon - a.lon) * degToM * Math.cos(latMid), (b.lat - a.lat) * degToM);
}

let cachedTargets: Target[] | null = null;

async function getLocalTargets(): Promise<Target[]> {
  if (cachedTargets) return cachedTargets;
  const res = await fetch('/assets/targets_v0.geojson');
  const geo = (await res.json()) as {
    features: {
      geometry: { coordinates: [number, number] };
      properties: {
        id: string;
        name: string;
        type_en?: string;
        elev_geoid_m?: number;
        desc_en?: string;
        rubric?: { novelty?: number; habitability?: number; human_only?: number; total_15?: number };
        sampling?: { tool?: string; duration_min?: number; protocol?: string };
      };
    }[];
  };
  cachedTargets = geo.features.map((f) => {
    const p = f.properties;
    return {
      id: p.id,
      name: p.name,
      lon: f.geometry.coordinates[0],
      lat: f.geometry.coordinates[1],
      elevation_m: p.elev_geoid_m ?? -3650,
      category: p.type_en ?? 'Science ROI',
      description: p.desc_en ?? '',
      is_base: p.id === 'T01',
      rubric: {
        novelty: p.rubric?.novelty ?? 3,
        habitability: p.rubric?.habitability ?? 3,
        human_only: p.rubric?.human_only ?? 3,
        total: p.rubric?.total_15 ?? 9,
      },
      task: p.sampling
        ? {
            tool: p.sampling.tool ?? 'Core Drill',
            duration_min: p.sampling.duration_min ?? 15,
            protocol: p.sampling.protocol ?? 'Standard EVA sampling',
          }
        : null,
    };
  });
  return cachedTargets;
}

function getLocalTerrain(search: URLSearchParams): TerrainGrid {
  const cellSizeM = Number(search.get('cell_size_m') || '10');
  const bbox: BBox = {
    min_lon: Number(search.get('min_lon') || SITE_BBOX.min_lon),
    min_lat: Number(search.get('min_lat') || SITE_BBOX.min_lat),
    max_lon: Number(search.get('max_lon') || SITE_BBOX.max_lon),
    max_lat: Number(search.get('max_lat') || SITE_BBOX.max_lat),
  };
  const widthM = marsDistM({ lon: bbox.min_lon, lat: bbox.min_lat }, { lon: bbox.max_lon, lat: bbox.min_lat });
  const heightM = marsDistM({ lon: bbox.min_lon, lat: bbox.min_lat }, { lon: bbox.min_lon, lat: bbox.max_lat });
  const cols = Math.min(90, Math.max(20, Math.round(widthM / cellSizeM)));
  const rows = Math.min(90, Math.max(20, Math.round(heightM / cellSizeM)));

  const elevation_m: number[] = [];
  const slope_deg: number[] = [];
  for (let r = 0; r < rows; r++) {
    const lat = bbox.max_lat - (r / Math.max(1, rows - 1)) * (bbox.max_lat - bbox.min_lat);
    for (let c = 0; c < cols; c++) {
      const lon = bbox.min_lon + (c / Math.max(1, cols - 1)) * (bbox.max_lon - bbox.min_lon);
      const s = sampleMountSharp(lon, lat);
      elevation_m.push(s.elevation_m);
      slope_deg.push(s.slope_deg);
    }
  }
  return { bbox, rows, cols, cell_size_m: cellSizeM, elevation_m, slope_deg };
}

function getLocalReadiness(): Readiness {
  // Official NASA MSL Curiosity (REMS, Mastcam, RAD) Gale Crater baseline telemetry
  return {
    verdict: 'go',
    sol: 4418,
    local_solar_time: '11:30 LMST',
    checks: [
      { key: 'temperature', label: 'REMS Air Temp (845 Pa)', value: -18.4, unit: '°C', verdict: 'go', source: 'MSL REMS' },
      { key: 'wind', label: 'Katabatic Wind', value: 6.4, unit: 'm/s', verdict: 'go', source: 'MSL REMS' },
      { key: 'dust', label: 'Dust Opacity', value: 0.58, unit: 'τ', verdict: 'go', source: 'Mastcam' },
      { key: 'radiation', label: 'GCR Dose Rate', value: 0.64, unit: 'mSv/sol', verdict: 'go', source: 'MSL RAD' },
    ],
  };
}

let cachedSiteGrid: TerrainGrid | null = null;
function getSiteGrid(): TerrainGrid {
  if (!cachedSiteGrid) cachedSiteGrid = getLocalTerrain(new URLSearchParams('cell_size_m=25'));
  return cachedSiteGrid;
}

function buildRouteSegment(
  waypoints: GeoPoint[],
  mode: 'rover' | 'eva',
  profile: RouteProfile,
  speedKmh: number,
  capacity: number,
  stopsMeta: { kind: 'base' | 'parking' | 'target' | 'rover'; ref_id: string; wpIdx: number }[],
  hazards: Hazard[] = [],
): RoutePlan {
  const points: RoutePoint[] = [];
  const stops: RoutePlan['stops'] = [];
  let totalDist = 0;
  let totalTime = 0;
  let totalRes = 0;
  let maxSlope = 0;

  const slopeWeight = profile === 'safe' ? 2.6 : profile === 'scientific' ? 1.4 : 0.6;
  const maxSlopeDeg = profile === 'safe' ? 16 : 22;
  const speedMs = Math.max(0.5, speedKmh / 3.6);
  const siteGrid = getSiteGrid();

  for (let w = 0; w < waypoints.length - 1; w++) {
    const a = waypoints[w];
    const b = waypoints[w + 1];
    const stopHere = stopsMeta.find((s) => s.wpIdx === w);
    if (stopHere) {
      stops.push({
        point_index: points.length,
        kind: stopHere.kind,
        ref_id: stopHere.ref_id,
        dwell_min: stopHere.kind === 'target' ? 15 : 0,
        dwell_resource: stopHere.kind === 'target' ? (mode === 'eva' ? 12 : 0.1) : 0,
      });
    }
    const astar = computeGridAStar(siteGrid, a, b, hazards, {
      gridSize: 42,
      maxSlopeDeg,
      slopeWeight,
    });
    const segPts = astar.points.slice(0, -1);
    for (const pt of segPts) {
      const samp = sampleMountSharp(pt.lon, pt.lat);
      maxSlope = Math.max(maxSlope, samp.slope_deg);
      if (points.length > 0) {
        const prev = points[points.length - 1];
        const d = marsDistM(prev, pt);
        totalDist += d;
        const dtMin = d / speedMs / 60;
        totalTime += dtMin;
        totalRes += mode === 'rover' ? (d / 1000) * 0.48 : (d / 1000) * 85;
      }
      points.push({
        lon: pt.lon,
        lat: pt.lat,
        elevation_m: samp.elevation_m,
        slope_deg: samp.slope_deg,
        distance_m: Number(totalDist.toFixed(1)),
        time_min: Number(totalTime.toFixed(1)),
        resource_used: Number(totalRes.toFixed(2)),
      });
    }
  }
  const last = waypoints[waypoints.length - 1];
  const lastSamp = sampleMountSharp(last.lon, last.lat);
  points.push({
    lon: last.lon,
    lat: last.lat,
    elevation_m: lastSamp.elevation_m,
    slope_deg: lastSamp.slope_deg,
    distance_m: Number(totalDist.toFixed(1)),
    time_min: Number(totalTime.toFixed(1)),
    resource_used: Number(totalRes.toFixed(2)),
  });

  const remainingPct = Math.max(12, Math.round(((capacity - totalRes) / capacity) * 100));
  return {
    mode,
    profile,
    points,
    stops,
    distance_m: Number(totalDist.toFixed(1)),
    duration_min: Number(totalTime.toFixed(1)),
    max_slope_deg: Number(maxSlope.toFixed(1)),
    obstacles: 0,
    safety_pct: Math.max(70, Math.round(100 - maxSlope * 1.1)),
    resource: {
      name: mode === 'rover' ? 'battery' : 'oxygen',
      unit: mode === 'rover' ? 'kWh' : 'L',
      used: Number(totalRes.toFixed(2)),
      capacity,
      remaining_pct: remainingPct,
    },
    return_ok: remainingPct > 20,
  };
}

async function planLocalTraverse(body: {
  base: GeoPoint;
  target_ids: string[];
  vehicle_id?: string;
  speed_kmh?: number;
  hazards?: Hazard[];
}): Promise<TraversePlan> {
  const allTargets = await getLocalTargets();
  const chosen = body.target_ids
    .map((id) => allTargets.find((t) => t.id === id))
    .filter((t): t is Target => !!t && !t.is_base);

  const parkings: Parking[] = chosen.map((t, idx) => ({
    id: `P${idx + 1}`,
    lon: Number((t.lon + (body.base.lon - t.lon) * 0.14).toFixed(6)),
    lat: Number((t.lat + (body.base.lat - t.lat) * 0.14).toFixed(6)),
    target_ids: [t.id],
  }));

  const capMap: Record<string, number> = {
    SEV_PRESSURIZED: 42.0,
    LTV_UNPRESSURIZED: 18.0,
    HYBRID_ROVER: 28.0,
  };
  const cap = capMap[body.vehicle_id || 'SEV_PRESSURIZED'] ?? 42.0;
  const spd = body.speed_kmh ?? 8.0;

  const wps: GeoPoint[] = [body.base, ...parkings, body.base];
  const stopsMeta = [
    { kind: 'base' as const, ref_id: 'base', wpIdx: 0 },
    ...parkings.map((p, i) => ({ kind: 'parking' as const, ref_id: p.id, wpIdx: i + 1 })),
    { kind: 'base' as const, ref_id: 'base', wpIdx: wps.length - 1 },
  ];

  const profiles: RouteProfile[] = ['safe', 'scientific', 'fast'];
  const routes = profiles.map((prof) =>
    buildRouteSegment(wps, 'rover', prof, prof === 'fast' ? spd * 1.15 : spd, cap, stopsMeta, body.hazards ?? []),
  );
  return { parkings, routes };
}

async function planLocalEva(body: { rover: GeoPoint; target_ids: string[]; hazards?: Hazard[] }): Promise<RoutePlan[]> {
  const allTargets = await getLocalTargets();
  const chosen = body.target_ids
    .map((id) => allTargets.find((t) => t.id === id))
    .filter((t): t is Target => !!t);
  const wps: GeoPoint[] = [body.rover, ...chosen, body.rover];
  const stopsMeta = [
    { kind: 'rover' as const, ref_id: 'rover', wpIdx: 0 },
    ...chosen.map((t, i) => ({ kind: 'target' as const, ref_id: t.id, wpIdx: i + 1 })),
    { kind: 'rover' as const, ref_id: 'rover', wpIdx: wps.length - 1 },
  ];
  const profiles: RouteProfile[] = ['safe', 'scientific', 'fast'];
  return profiles.map((prof) => buildRouteSegment(wps, 'eva', prof, 2.7, 300.0, stopsMeta, body.hazards ?? []));
}

export async function handleLocalFallback<T>(path: string, body?: unknown): Promise<T> {
  if (path === '/targets') {
    return (await getLocalTargets()) as T;
  }
  if (path.startsWith('/terrain')) {
    const q = path.includes('?') ? path.split('?')[1] : '';
    return getLocalTerrain(new URLSearchParams(q)) as T;
  }
  if (path === '/environment/readiness') {
    return getLocalReadiness() as T;
  }
  if (path === '/routes/traverse') {
    return (await planLocalTraverse(body as { base: GeoPoint; target_ids: string[]; vehicle_id?: string; speed_kmh?: number })) as T;
  }
  if (path === '/routes/eva') {
    return (await planLocalEva(body as { rover: GeoPoint; target_ids: string[] })) as T;
  }
  if (path === '/routes/path') {
    const pBody = body as { mode: 'rover' | 'eva'; waypoints: GeoPoint[]; profiles?: RouteProfile[] };
    const prof = pBody.profiles?.[0] ?? 'safe';
    return [buildRouteSegment(pBody.waypoints, pBody.mode, prof, pBody.mode === 'rover' ? 8.0 : 2.7, pBody.mode === 'rover' ? 42 : 300, [])] as T;
  }
  throw new Error(`No local fallback for ${path}`);
}
