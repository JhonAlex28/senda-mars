import { http } from '@/shared/api/httpClient';
import { config } from '@/shared/config/env';
import type { GeoPoint } from '@/shared/types/geo';

export type Leg = 'eva' | 'rover';

/** Espejo de ReturnFieldResponse (GET /return-field). */
export interface ReturnFieldMeta {
  leg: Leg;
  scenario: string;
  bbox_lonlat: [number, number, number, number];
  unit: string;
  max_value: number;
  source_id: string;
}

function query(leg: Leg, at?: GeoPoint | null): string {
  const p = new URLSearchParams({ leg });
  if (leg === 'eva' && at) {
    p.set('lon', String(at.lon));
    p.set('lat', String(at.lat));
  }
  return p.toString();
}

/** Espejo de ScenarioOut (GET /scenarios). */
export interface ScenarioInfo {
  id: 'none' | 'dust_storm' | 'sep_event' | 'suit_leak' | 'injury' | 'blocked_path';
  label: string;
  effect: string;
  kind: string;
}

export interface EngineAlert {
  level: 'info' | 'caution' | 'rtb';
  code: string;
  msg: string;
}

/** Espejo de SimRowOut. */
export interface SimRow {
  t_min: number;
  lonlat: [number, number];
  progress: number; // 0..1 a lo largo de la ruta
  o2_left_L: number;
  return_o2_L: number;
  reserve_L: number;
  next_wp: string | null;
  dist_left_m: number;
  alert: EngineAlert | null;
}

/** Espejo de SimulateResponse. */
export interface SimulateResult {
  scenario: string;
  timeline: SimRow[];
  diversion: { at_index: number; to: string; path: [number, number][] } | null;
}

/** Ruta EVA para /simulate: puntos lon/lat y paradas en objetivos (índice del punto). */
export interface SimRoute {
  profile: string;
  path: GeoPoint[];
  stops: { target_id: string; path_index: number }[];
}

export const safetyApi = {
  scenarios: () => http.get<ScenarioInfo[]>('/scenarios'),

  /** Reproduce la EVA en el motor con un escenario desde el punto `atIndex` (alertas, reserva, desvío). */
  simulate: (route: SimRoute, scenario: ScenarioInfo['id'], atIndex: number) =>
    http.post<SimulateResult>('/simulate', {
      route: { profile: route.profile, path: route.path.map((p) => [p.lon, p.lat]), stops: route.stops },
      scenario,
      scenario_at_index: atIndex,
    }),

  /** Metadatos del campo de retorno: EVA hacia el vehículo estacionado en `at`, o vehículo hacia la base. */
  returnField: (leg: Leg, at?: GeoPoint | null) => http.get<ReturnFieldMeta>(`/return-field?${query(leg, at)}`),
  /** PNG de la zona desde la que se puede volver con margen (misma base de URL que la API). */
  safeMaskUrl: (leg: Leg, at?: GeoPoint | null) => `${config.apiBaseUrl}/return-field/safe-mask.png?${query(leg, at)}`,
};
