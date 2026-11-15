import type { Hazard, RoutePlan, RouteProfile, TraversePlan } from '@/features/route-planning';
import type { GeoPoint } from '@/shared/types/geo';
import type { RoverVehicleId } from './vehicles';

/** Pantallas principales: globo → Plan (rover) → Walk (EVAs) → Go (simulación). */
export type Phase = 'globe' | 'plan' | 'walk' | 'go';

export type MapTool = 'select' | 'hazard' | 'waypoint';

/** Pasos guiados de la planificación (se derivan del estado, no se guardan). */
export type PlanStep = 'goals' | 'traverse' | 'eva' | 'ready';

export interface EvaPlan {
  routes: RoutePlan[];
  profile: RouteProfile;
}

export interface CrewMember {
  id: 'EVA-1' | 'EVA-2';
  name: string;
  role: string;
  suitId: string;
  restingBpm: number;
  massKg: number;
}

export interface CrewConfig {
  teamName: string;
  members: [CrewMember, CrewMember];
}

export interface QuantumSummary {
  backendName: string;
  jobId: string;
  nQubits: number;
  layers: number;
  shots: number;
  bestBitstring: string;
  expectationValue: number;
  recommendedTargetIds: string[];
  deltaKm?: number;
  deltaKwh?: number;
}

export interface MissionState {
  phase: Phase;
  missionId: string;
  base: GeoPoint | null;
  goals: string[]; // ids en orden de prioridad
  hazards: Hazard[];
  /** Puntos de paso del vehículo marcados por el usuario (W1…Wn, en orden de creación). */
  waypoints: GeoPoint[];
  tool: MapTool;
  focusedTargetId: string | null;
  traverse: TraversePlan | null;
  traverseProfile: RouteProfile;
  activeParkingId: string | null;
  evaPlans: Record<string, EvaPlan>;
  vehicleId: RoverVehicleId;
  crew: CrewConfig;
  quantumSummary: QuantumSummary | null;
  /** Modal "Crew status" (HUD del casco) durante la ejecución. */
  crewStatusOpen: boolean;
  notice: string | null;
}

export type MissionAction =
  | { type: 'openMission'; missionId: string }
  | { type: 'backToGlobe' }
  | { type: 'setPhase'; phase: Phase }
  | { type: 'initBase'; point: GeoPoint }
  | { type: 'toggleGoal'; id: string }
  | { type: 'moveGoal'; from: number; to: number }
  | { type: 'focusTarget'; id: string | null }
  | { type: 'addHazard'; hazard: Hazard }
  | { type: 'removeHazard'; index: number }
  | { type: 'clearHazards' }
  | { type: 'addWaypoint'; point: GeoPoint }
  | { type: 'removeWaypoint'; index: number }
  | { type: 'setTool'; tool: MapTool }
  | { type: 'traversePlanned'; plan: TraversePlan }
  | { type: 'selectTraverseProfile'; profile: RouteProfile }
  | { type: 'selectParking'; id: string }
  | { type: 'evaPlanned'; parkingId: string; routes: RoutePlan[] }
  | { type: 'selectEvaProfile'; parkingId: string; profile: RouteProfile }
  | { type: 'setCrew'; crew: CrewConfig }
  | { type: 'setCrewStatusOpen'; open: boolean }
  | { type: 'applyQuantumGoals'; goals: string[]; summary: QuantumSummary }
  | { type: 'loadDemo'; goals: string[] }
  | { type: 'resetMission' }
  | { type: 'dismissNotice' }
  // Un plan completo calculado de una vez (lo usa el asistente): objetivos, rutas y perfiles
  | {
      type: 'planLoaded';
      goals: string[];
      hazards: Hazard[];
      traverse: TraversePlan;
      traverseProfile: RouteProfile;
      evaPlans: Record<string, EvaPlan>;
    }
  | { type: 'viewChanged'; profile?: RouteProfile; phase?: Exclude<Phase, 'globe'> };
