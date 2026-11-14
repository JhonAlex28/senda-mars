import type { Hazard, RoutePlan, RouteProfile, TraversePlan } from '@/features/route-planning';
import type { GeoPoint } from '@/shared/types/geo';

/** Pantallas principales: globo → Plan (rover) → Walk (EVAs) → Go (simulación). */
export type Phase = 'globe' | 'plan' | 'walk' | 'go';

export type MapTool = 'select' | 'base' | 'hazard';

/** Pasos guiados de la planificación (se derivan del estado, no se guardan). */
export type PlanStep = 'base' | 'goals' | 'traverse' | 'eva' | 'ready';

export interface EvaPlan {
  routes: RoutePlan[];
  profile: RouteProfile;
}

export interface MissionState {
  phase: Phase;
  base: GeoPoint | null;
  baseConfirmed: boolean;
  goals: string[]; // ids en orden de prioridad
  hazards: Hazard[];
  tool: MapTool;
  focusedTargetId: string | null;
  traverse: TraversePlan | null;
  traverseProfile: RouteProfile;
  activeParkingId: string | null;
  evaPlans: Record<string, EvaPlan>;
  notice: string | null;
}

export type MissionAction =
  | { type: 'openMission' }
  | { type: 'backToGlobe' }
  | { type: 'setPhase'; phase: Phase }
  | { type: 'initBase'; point: GeoPoint }
  | { type: 'moveBase'; point: GeoPoint }
  | { type: 'confirmBase' }
  | { type: 'editBase' }
  | { type: 'toggleGoal'; id: string }
  | { type: 'moveGoal'; from: number; to: number }
  | { type: 'focusTarget'; id: string | null }
  | { type: 'addHazard'; hazard: Hazard }
  | { type: 'removeHazard'; index: number }
  | { type: 'clearHazards' }
  | { type: 'setTool'; tool: MapTool }
  | { type: 'traversePlanned'; plan: TraversePlan }
  | { type: 'selectTraverseProfile'; profile: RouteProfile }
  | { type: 'selectParking'; id: string }
  | { type: 'evaPlanned'; parkingId: string; routes: RoutePlan[] }
  | { type: 'selectEvaProfile'; parkingId: string; profile: RouteProfile }
  | { type: 'dismissNotice' };
