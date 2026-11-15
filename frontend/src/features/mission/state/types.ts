import type { Hazard, RoutePlan, RouteProfile, TraversePlan } from '@/features/route-planning';
import type { GeoPoint } from '@/shared/types/geo';
import type { RoverVehicleId } from './vehicles';

/** Pantallas principales: globo → Plan (rover) → Walk (EVAs) → Go (simulación). */
export type Phase = 'globe' | 'plan' | 'walk' | 'go';

export type MapTool = 'select' | 'hazard' | 'waypoint';

/** Pasos guiados de la planificación (se derivan del estado, no se guardan). */
export type PlanStep = 'goals' | 'traverse' | 'eva' | 'ready';

/** Punto de paso del vehículo; se ordena en la lista de objetivos como uno más. */
export interface UserWaypoint extends GeoPoint {
  id: string;
}

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

/** Plan guardado que está abierto en pantalla (guardar lo actualiza en lugar de duplicarlo). */
export interface ActivePlan {
  id: string;
  title: string;
  sol: number;
}

/** Lo que se guarda de un plan: exactamente lo necesario para volver a dibujarlo. */
export interface SavedPlanPayload {
  base: GeoPoint | null;
  goals: string[];
  hazards: Hazard[];
  traverse: TraversePlan | null;
  traverseProfile: RouteProfile;
  evaPlans: Record<string, EvaPlan>;
  vehicleId: RoverVehicleId;
  /** Solo en planes guardados antes de que la velocidad pasara al backend (se ignora). */
  vehicleSpeedKmh?: number;
}

export interface MissionState {
  phase: Phase;
  missionId: string;
  base: GeoPoint | null;
  goals: string[]; // ids en orden de prioridad
  hazards: Hazard[];
  /** Puntos de paso del vehículo marcados por el usuario. Su id (W1…) también va en `goals`. */
  waypoints: UserWaypoint[];
  nextWaypoint: number; // contador para ids estables W1, W2…
  tool: MapTool;
  focusedTargetId: string | null;
  traverse: TraversePlan | null;
  traverseProfile: RouteProfile;
  activeParkingId: string | null;
  evaPlans: Record<string, EvaPlan>;
  vehicleId: RoverVehicleId;
  crew: CrewConfig;
  quantumSummary: QuantumSummary | null;
  activePlan: ActivePlan | null;
  profileId: string; // tripulante que planifica en este equipo (EVA-1, EVA-2…)
  /** Modal "Crew status" (HUD del casco) durante la ejecución. */
  crewStatusOpen: boolean;
  /** Chat lateral del copiloto (se abre desde la cabecera; en el globo, desde el botón flotante). */
  copilotOpen: boolean;
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
  | { type: 'removeWaypoint'; id: string }
  /** Orden optimizado por el backend: reescribe la lista y carga ese plan. */
  | { type: 'optimizedPlanned'; plan: TraversePlan; goals: string[] }
  /** Fin de la simulación: interfaz limpia (se conservan base, tripulación e historial). */
  | { type: 'finishMission'; toGlobe?: boolean }
  | { type: 'setTool'; tool: MapTool }
  | { type: 'traversePlanned'; plan: TraversePlan }
  | { type: 'selectTraverseProfile'; profile: RouteProfile }
  | { type: 'selectParking'; id: string }
  | { type: 'evaPlanned'; parkingId: string; routes: RoutePlan[] }
  | { type: 'selectEvaProfile'; parkingId: string; profile: RouteProfile }
  | { type: 'setCrew'; crew: CrewConfig }
  | { type: 'setCrewStatusOpen'; open: boolean }
  | { type: 'setCopilotOpen'; open: boolean }
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
  | { type: 'viewChanged'; profile?: RouteProfile; phase?: Exclude<Phase, 'globe'> }
  | { type: 'planOpened'; plan: SavedPlanPayload; active: ActivePlan }
  | { type: 'activePlanSet'; active: ActivePlan | null }
  | { type: 'setProfile'; id: string };
