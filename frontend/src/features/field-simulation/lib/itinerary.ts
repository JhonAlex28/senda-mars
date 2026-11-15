import type { RoutePlan, RouteProfile, StopKind, TravelMode, Waypoint } from '@/features/route-planning';
import { bearingDeg, lerpPoint } from '@/shared/lib/geo';
import type { GeoPoint } from '@/shared/types/geo';

/** Punto de un tramo con valores acumulados desde su inicio: d (m), t (min), r (recurso). */
export interface LegPoint extends GeoPoint {
  d: number;
  t: number;
  r: number;
}

export interface LegStop {
  index: number;
  kind: StopKind;
  refId: string;
  dwellMin: number;
  dwellResource: number;
}

/** Un tramo de la excursión: un recorrido en rover o una caminata EVA. */
export interface Leg {
  id: string;
  mode: TravelMode;
  title: string;
  parkingId: string | null;
  profile: RouteProfile;
  points: LegPoint[];
  stops: LegStop[];
  capacity: number;
}

interface LegOptions {
  id: string;
  title: string;
  parkingId: string | null;
  from?: number;
  to?: number;
}

/** Recorta [from, to] de una ruta y lo re-referencia para que empiece en 0. */
export function legFromRoute(route: RoutePlan, { id, title, parkingId, from = 0, to }: LegOptions): Leg {
  const end = to ?? route.points.length - 1;
  const origin = route.points[from];
  return {
    id,
    title,
    parkingId,
    mode: route.mode,
    profile: route.profile,
    capacity: route.resource.capacity,
    points: route.points.slice(from, end + 1).map((p) => ({
      lon: p.lon,
      lat: p.lat,
      d: p.distance_m - origin.distance_m,
      t: p.time_min - origin.time_min,
      r: p.resource_used - origin.resource_used,
    })),
    stops: route.stops
      .filter((s) => s.point_index > from && s.point_index <= end)
      .map((s) => ({
        index: s.point_index - from,
        kind: s.kind,
        refId: s.ref_id,
        dwellMin: s.dwell_min,
        dwellResource: s.dwell_resource,
      })),
  };
}

/** Recorrido del rover partido en tramos, con la caminata de cada estacionamiento intercalada. */
export function buildItinerary(traverse: RoutePlan, walks: Record<string, RoutePlan | undefined>): Leg[] {
  const legs: Leg[] = [];
  let from = 0;
  for (const stop of traverse.stops) {
    const toParking = stop.kind === 'parking';
    legs.push(
      legFromRoute(traverse, {
        id: `drive-${stop.ref_id}`,
        title: toParking ? `Drive to stop ${stop.ref_id}` : 'Drive back to base',
        parkingId: toParking ? stop.ref_id : null,
        from,
        to: stop.point_index,
      }),
    );
    from = stop.point_index;
    const walk = toParking ? walks[stop.ref_id] : undefined;
    if (walk) {
      legs.push(legFromRoute(walk, { id: `walk-${stop.ref_id}`, title: `Spacewalk from ${stop.ref_id}`, parkingId: stop.ref_id }));
    }
  }
  return legs;
}

export interface LegSample {
  point: GeoPoint;
  heading: number;
  d: number;
  r: number;
}

/** Posición, rumbo, distancia y consumo en el minuto t del tramo (interpolación lineal). */
export function sampleLeg(leg: Leg, t: number): LegSample {
  const pts = leg.points;
  const last = pts[pts.length - 1];
  if (pts.length === 1 || t >= last.t) {
    return { point: last, heading: pts.length > 1 ? bearingDeg(pts[pts.length - 2], last) : 0, d: last.d, r: last.r };
  }
  let i = 0;
  while (i < pts.length - 2 && pts[i + 1].t <= t) i++;
  const a = pts[i];
  const b = pts[i + 1];
  const f = b.t > a.t ? (t - a.t) / (b.t - a.t) : 1;
  return {
    point: lerpPoint(a, b, f),
    heading: bearingDeg(a, b),
    d: a.d + (b.d - a.d) * f,
    r: a.r + (b.r - a.r) * f,
  };
}

/** Punto situado `aheadM` metros más adelante (sin pasar de `maxD`). */
export function pointAhead(leg: Leg, fromD: number, aheadM: number, maxD: number): GeoPoint {
  const target = Math.min(fromD + aheadM, maxD);
  const pts = leg.points;
  let i = 0;
  while (i < pts.length - 2 && pts[i + 1].d < target) i++;
  const a = pts[i];
  const b = pts[i + 1] ?? a;
  const f = b.d > a.d ? (target - a.d) / (b.d - a.d) : 0;
  return lerpPoint(a, b, Math.min(Math.max(f, 0), 1));
}

export function legEnd(leg: Leg): LegPoint {
  return leg.points[leg.points.length - 1];
}

export function stopPoint(leg: Leg, stop: LegStop): LegPoint {
  return leg.points[stop.index];
}

/** Waypoint para pedir una nueva ruta que pase por esta parada. */
export function stopWaypoint(leg: Leg, stop: LegStop): Waypoint {
  const p = stopPoint(leg, stop);
  return { lon: p.lon, lat: p.lat, kind: stop.kind, ref_id: stop.refId };
}

/** Tiempo y consumo que faltan del tramo (incluye las tareas pendientes). */
export function legRemaining(leg: Leg, t: number, nextStop: number): { minutes: number; distance: number; resource: number } {
  const end = legEnd(leg);
  const here = sampleLeg(leg, t);
  const pending = leg.stops.slice(nextStop);
  return {
    minutes: end.t - Math.min(t, end.t) + pending.reduce((s, x) => s + x.dwellMin, 0),
    distance: end.d - here.d,
    resource: end.r - here.r + pending.reduce((s, x) => s + x.dwellResource, 0),
  };
}

export interface PlanTotals {
  minutes: number;
  roverDistance: number;
  walkDistance: number;
  battery: number;
  oxygen: number;
  targets: number;
}

export function itineraryTotals(legs: Leg[]): PlanTotals {
  return legs.reduce<PlanTotals>(
    (acc, leg) => {
      const end = legEnd(leg);
      const dwell = leg.stops.reduce((s, x) => s + x.dwellMin, 0);
      const dwellRes = leg.stops.reduce((s, x) => s + x.dwellResource, 0);
      acc.minutes += end.t + dwell;
      if (leg.mode === 'rover') {
        acc.roverDistance += end.d;
        acc.battery += end.r + dwellRes;
      } else {
        acc.walkDistance += end.d;
        acc.oxygen += end.r + dwellRes;
        acc.targets += leg.stops.filter((s) => s.kind === 'target').length;
      }
      return acc;
    },
    { minutes: 0, roverDistance: 0, walkDistance: 0, battery: 0, oxygen: 0, targets: 0 },
  );
}
