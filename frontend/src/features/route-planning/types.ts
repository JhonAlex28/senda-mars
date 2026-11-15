import type { GeoPoint } from '@/shared/types/geo';

/** Espejos de los DTOs de /api/v1/routes. */
export type RouteProfile = 'safe' | 'scientific' | 'fast';
export type TravelMode = 'rover' | 'eva';
export type StopKind = 'base' | 'parking' | 'target' | 'rover' | 'waypoint';

export interface RoutePoint extends GeoPoint {
  elevation_m: number;
  slope_deg: number;
  distance_m: number;
  time_min: number; // solo desplazamiento, acumulado
  resource_used: number; // solo desplazamiento, acumulado
}

export interface RouteStop {
  point_index: number;
  kind: StopKind;
  ref_id: string;
  dwell_min: number;
  dwell_resource: number;
}

export interface Resource {
  name: 'battery' | 'oxygen';
  unit: string;
  used: number;
  capacity: number;
  remaining_pct: number;
}

export interface RoutePlan {
  mode: TravelMode;
  profile: RouteProfile;
  points: RoutePoint[];
  stops: RouteStop[];
  distance_m: number;
  duration_min: number;
  max_slope_deg: number;
  obstacles: number;
  safety_pct: number;
  resource: Resource;
  return_ok: boolean;
}

export interface Parking extends GeoPoint {
  id: string;
  target_ids: string[];
}

export interface TraversePlan {
  parkings: Parking[];
  routes: RoutePlan[];
}

export interface Hazard extends GeoPoint {
  radius_m: number;
}

export interface Conditions {
  speed_factor: number;
  o2_multiplier: number;
}

export interface Waypoint extends GeoPoint {
  kind: StopKind;
  ref_id: string;
}

export interface Scenario {
  hazards: Hazard[];
  conditions?: Conditions;
}
