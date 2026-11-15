/** Espejo de los DTOs del planner (backend/src/senda/adapters/inbound/http/schemas.py). */
import type { LonLat } from '@/shared/types/geo';

export type RouteProfile = 'safe' | 'fast' | 'scientific';
export type ScenarioId = 'none' | 'dust_storm' | 'sep_event' | 'suit_leak' | 'injury' | 'blocked_path';
export type Cell = [row: number, col: number];

export interface Assumption {
  value: unknown;
  kind: string; // medido | modelado | supuesto | synthetic | ...
  source: string;
}

export interface GridInfo {
  scale: 'local' | 'regional';
  kind: 'measured' | 'synthetic';
  cell_size_m: number;
  shape: [number, number];
  bbox_lonlat: [number, number, number, number];
  sources: Record<string, unknown>[];
}

export interface ElevationPoint {
  d_m: number;
  z_m: number;
}

export interface RouteMetrics {
  dist_m: number;
  ascent_m: number;
  descent_m: number;
  max_slope_deg: number;
  energy_kJ: number;
  o2_L: number;
  time_min: number;
  walk_time_min: number;
  dose_mSv: number;
  science_score: number;
  o2_margin_at_end: number;
  feasible: boolean;
}

export interface Segment {
  from: string;
  to: string;
  dist_m: number;
  energy_kJ: number;
  time_min: number;
  o2_L: number;
}

export interface Stop {
  target_id: string;
  path_index: number;
  task_min: number;
  energy_kJ: number;
}

export interface Route {
  profile: RouteProfile;
  path: LonLat[];
  cells: Cell[];
  metrics: RouteMetrics;
  segments: Segment[];
  stops: Stop[];
  elevation_profile: ElevationPoint[];
  pnr_index: number | null;
  infeasible_reasons: string[];
}

export interface RoutesRequest {
  target_ids: string[];
  profiles?: RouteProfile[];
  start_target_id?: string | null;
  end_target_id?: string | null;
  scenario?: ScenarioId;
}

export interface RoutesResponse {
  staging_id: string;
  routes: Route[];
  grid: GridInfo;
  assumptions: Record<string, Assumption>;
}

export interface TraverseMetrics {
  dist_m: number;
  ascent_m: number;
  max_slope_deg: number;
  energy_kWh: number;
  battery_used_pct: number;
  time_min: number;
  feasible: boolean;
}

export interface Traverse {
  path: LonLat[];
  metrics: TraverseMetrics;
  elevation_profile: ElevationPoint[];
  reserve_kWh_min: number | null;
}

export interface TimelineItem {
  sol: number;
  start: string; // LTST "HH:MM"
  end: string;
  activity: 'drive_out' | 'standby' | 'overnight' | 'egress' | 'eva' | 'ingress' | 'drive_back';
  profile: RouteProfile | null;
}

export interface MissionRequest {
  base?: LonLat | null;
  staging_target_id?: string | null;
  target_ids: string[];
  profiles?: RouteProfile[];
  timeline_profile?: RouteProfile;
  departure?: { sol?: number | null; ltst?: string };
  scenario?: ScenarioId;
}

export interface MissionResponse {
  base: { lonlat: LonLat; target_id: string | null };
  staging: { lonlat: LonLat; target_id: string | null };
  traverse_out: Traverse;
  eva: { routes: Route[]; grid: GridInfo };
  traverse_back: Traverse;
  timeline_profile: RouteProfile;
  timeline: TimelineItem[];
  feasible: boolean;
  warnings: { code: string; msg: string }[];
  regional_grid: GridInfo;
  assumptions: Record<string, Assumption>;
}

export interface ReturnFieldResponse {
  leg: 'eva' | 'rover';
  scenario: string;
  png_url: string;
  safe_mask_png_url: string;
  bbox_lonlat: [number, number, number, number];
  unit: string;
  max_value: number;
  source_id: string;
}
