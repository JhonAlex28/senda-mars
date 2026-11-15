/** Espejo de los DTOs de simulación (backend/src/senda/adapters/inbound/http/schemas.py). */
import type { LonLat } from '@/shared/types/geo';
import type { Assumption, Cell, Route, RouteProfile, ScenarioId } from '@/features/route-planning';

export interface Alert {
  level: 'info' | 'caution' | 'rtb';
  code: 'PNR_REACHED' | 'SEP_EVENT' | 'WINDOW_END' | 'RESERVE_LOW' | 'DOSE_HIGH' | 'SLOPE_AHEAD' | 'LOW_CONFIDENCE' | string;
  msg: string;
}

export interface SimRow {
  t_min: number;
  lonlat: LonLat;
  cell: Cell;
  progress: number;
  o2_left_L: number;
  return_o2_L: number; // -1 = sin retorno posible
  reserve_L: number;
  dose_mSv: number;
  next_wp: string | null;
  dist_left_m: number;
  alert: Alert | null;
}

export interface SimulateRequest {
  route: { profile: RouteProfile; cells: Cell[]; stops: { target_id: string; path_index: number }[] };
  scenario?: ScenarioId;
  scenario_at_index?: number;
}

export interface SimulateResponse {
  scenario: ScenarioId;
  timeline: SimRow[];
  replanned_route: Route | null;
  diversion: { at_index: number; to: string; path: LonLat[] } | null;
  rideback: null;
  assumptions: Record<string, Assumption>;
}

export interface ScenarioInfo {
  id: ScenarioId;
  label: string;
  effect: string;
  kind: string;
}
