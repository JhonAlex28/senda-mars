import type { Readiness } from '@/features/environment';
import type { Hazard, RoutePlan, RouteProfile, TraversePlan } from '@/features/route-planning';
import type { GeoPoint } from '@/shared/types/geo';

/** Espejos de los DTOs de /api/v1/assistant. */
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** Resumen de un tramo ya calculado por el planificador (lo que el usuario ve en pantalla). */
export interface LegSummary {
  profile: RouteProfile;
  duration_min: number;
  distance_m: number;
  safety_pct: number;
  resource_left_pct: number;
  return_ok: boolean;
}

export interface PlanSummary {
  rover: LegSummary | null;
  spacewalks: (LegSummary & { parking: string; targets: string[] })[];
  parkings_without_spacewalk: string[];
}

/** Lo que el usuario tiene en pantalla: el asistente parte de ahí. */
export interface MissionSnapshot {
  base: GeoPoint | null;
  goals: string[];
  hazards: Hazard[];
  has_plan: boolean;
  screen: 'globe' | 'plan' | 'walk' | 'go';
  plan: PlanSummary | null;
}

export interface Outing {
  planned: boolean;
  target_ids: string[];
  dropped: { id: string; reason: 'time' | 'no_safe_return' }[];
  hazards: Hazard[];
  speed_factor: number;
  o2_multiplier: number;
  budget_min: number | null;
  total_duration_min: number;
  traverse: TraversePlan | null;
  traverse_profile: RouteProfile | null;
  evas: Record<string, RoutePlan[]>;
  eva_profiles: Record<string, RouteProfile>;
}

export type Screen = 'plan' | 'walk' | 'go';

export interface ViewChange {
  profile: RouteProfile | null;
  screen: Screen | null;
}

export interface ChatReply {
  reply: string;
  refused: boolean;
  truncated: boolean;
  tools_used: string[];
  readiness: Readiness | null;
  outing: Outing | null;
  view: ViewChange | null;
}

export interface AssistantStatus {
  enabled: boolean;
  reachable: boolean;
  model: string | null;
}

/** Estado del copiloto para la interfaz (cada uno tiene su propio aviso). */
export type Availability = 'checking' | 'ready' | 'disabled' | 'offline' | 'no-backend';
