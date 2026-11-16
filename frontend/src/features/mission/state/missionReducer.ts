import { planSignature } from './selectors';
import type { MissionAction, MissionState } from './types';

export const initialMissionState: MissionState = {
  phase: 'globe',
  missionId: 'mount-sharp',
  base: null,
  goals: [],
  hazards: [],
  waypoints: [],
  nextWaypoint: 1,
  tool: 'select',
  focusedTargetId: null,
  traverse: null,
  traverseProfile: 'safe',
  activeParkingId: null,
  evaPlans: {},
  vehicleId: 'SEV_PRESSURIZED',
  crew: {
    teamName: 'SENDA CREW',
    members: [
      { id: 'EVA-1', name: 'EVA-1', role: 'CDR', suitId: 'xEMU-01', restingBpm: 68, massKg: 78 },
      { id: 'EVA-2', name: 'EVA-2', role: 'GEO', suitId: 'xEMU-02', restingBpm: 64, massKg: 68 },
    ],
  },
  quantumSummary: null,
  activePlan: null,
  profileId: 'EVA-1',
  crewStatusOpen: false,
  copilotOpen: false,
  notice: null,
};

/** Cambiar base, objetivos o peligros deja obsoletas las rutas calculadas. */
function invalidatePlan(state: MissionState, reason: string): MissionState {
  if (!state.traverse) return state;
  return {
    ...state,
    traverse: null,
    evaPlans: {},
    activeParkingId: null,
    phase: state.phase === 'walk' ? 'plan' : state.phase,
    notice: `${reason} Plan the route again.`,
  };
}

function move<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function missionReducer(state: MissionState, action: MissionAction): MissionState {
  switch (action.type) {
    case 'openMission':
      return { ...state, missionId: action.missionId, phase: 'plan' };
    case 'backToGlobe':
      return { ...state, phase: 'globe' };
    case 'setPhase':
      return { ...state, phase: action.phase, tool: 'select', focusedTargetId: null };

    // Las bases son fijas (ya establecidas): solo se toma la del catálogo
    case 'initBase':
      return state.base ? state : { ...state, base: action.point };

    case 'toggleGoal': {
      const has = state.goals.includes(action.id);
      const goals = has ? state.goals.filter((g) => g !== action.id) : [...state.goals, action.id];
      // Quitar un waypoint de la lista también lo quita del mapa
      const waypoints = has ? state.waypoints.filter((w) => w.id !== action.id) : state.waypoints;
      return invalidatePlan({ ...state, goals, waypoints }, 'Goals changed.');
    }
    case 'moveGoal':
      if (action.to < 0 || action.to >= state.goals.length) return state;
      return invalidatePlan({ ...state, goals: move(state.goals, action.from, action.to) }, 'Goal order changed.');
    case 'focusTarget':
      return { ...state, focusedTargetId: action.id };

    case 'addHazard':
      return invalidatePlan({ ...state, hazards: [...state.hazards, action.hazard] }, 'Danger zone added.');
    case 'removeHazard':
      return invalidatePlan(
        { ...state, hazards: state.hazards.filter((_, i) => i !== action.index) },
        'Danger zone removed.',
      );
    case 'clearHazards':
      return invalidatePlan({ ...state, hazards: [] }, 'Danger zones cleared.');
    case 'addWaypoint': {
      const id = `W${state.nextWaypoint}`;
      return invalidatePlan(
        {
          ...state,
          waypoints: [...state.waypoints, { ...action.point, id }],
          goals: [...state.goals, id],
          nextWaypoint: state.nextWaypoint + 1,
        },
        'Waypoint added.',
      );
    }
    case 'removeWaypoint':
      return invalidatePlan(
        {
          ...state,
          waypoints: state.waypoints.filter((w) => w.id !== action.id),
          goals: state.goals.filter((g) => g !== action.id),
        },
        'Waypoint removed.',
      );
    case 'optimizedPlanned':
      return {
        ...state,
        goals: action.goals,
        traverse: action.plan,
        evaPlans: {},
        activeParkingId: action.plan.parkings[0]?.id ?? null,
        focusedTargetId: null,
        notice: 'Order optimized.',
      };
    case 'finishMission':
      return {
        ...initialMissionState,
        phase: action.toGlobe ? 'globe' : 'plan',
        missionId: state.missionId,
        base: state.base,
        crew: state.crew,
      };
    case 'setTool':
      return { ...state, tool: action.tool };

    case 'traversePlanned':
      return {
        ...state,
        traverse: action.plan,
        evaPlans: {},
        activeParkingId: action.plan.parkings[0]?.id ?? null,
        focusedTargetId: null,
        notice: null,
      };
    case 'selectTraverseProfile':
      return { ...state, traverseProfile: action.profile };
    case 'selectParking':
      return { ...state, activeParkingId: action.id };
    case 'evaPlanned':
      return {
        ...state,
        evaPlans: { ...state.evaPlans, [action.parkingId]: { routes: action.routes, profile: 'safe' } },
      };
    case 'selectEvaProfile': {
      const plan = state.evaPlans[action.parkingId];
      if (!plan) return state;
      return { ...state, evaPlans: { ...state.evaPlans, [action.parkingId]: { ...plan, profile: action.profile } } };
    }

    case 'setCrew':
      return { ...state, crew: action.crew };
    case 'setCrewStatusOpen':
      return { ...state, crewStatusOpen: action.open };
    case 'setCopilotOpen':
      return { ...state, copilotOpen: action.open };
    case 'applyQuantumGoals':
      return invalidatePlan(
        { ...state, goals: action.goals, quantumSummary: action.summary },
        `IBM Quantum QAOA (${action.summary.bestBitstring}) updated your mission sequence.`,
      );
    case 'loadDemo':
      return {
        ...state,
        phase: 'plan',
        goals: action.goals,
        traverse: null,
        evaPlans: {},
        activeParkingId: null,
        tool: 'select',
        notice: 'Demo: 3 targets loaded.',
      };
    case 'resetMission':
      return {
        ...initialMissionState,
        phase: 'plan',
        base: state.base,
        crew: state.crew,
        profileId: state.profileId,
        notice: 'Mission reset.',
      };

    case 'dismissNotice':
      return { ...state, notice: null };

    case 'planLoaded':
      // El plan del asistente no trae waypoints de usuario: se descartan para que lista y mapa coincidan
      return {
        ...state,
        activePlan: null, // es un plan nuevo: guardarlo crea otro, no pisa el que estaba abierto
        phase: 'walk',
        tool: 'select',
        goals: action.goals,
        waypoints: [],
        hazards: action.hazards,
        traverse: action.traverse,
        traverseProfile: action.traverseProfile,
        evaPlans: action.evaPlans,
        activeParkingId: action.traverse.parkings[0]?.id ?? null,
        focusedTargetId: null,
        notice: null,
      };
    case 'planOpened': {
      const p = action.plan;
      const ready = !!p.traverse && p.traverse.parkings.every((pk) => p.evaPlans[pk.id]);
      const opened: MissionState = {
        ...state,
        phase: p.traverse ? (ready ? 'walk' : 'plan') : 'plan',
        tool: 'select',
        base: p.base ?? state.base,
        goals: p.goals,
        hazards: p.hazards,
        traverse: p.traverse,
        traverseProfile: p.traverseProfile,
        evaPlans: p.evaPlans,
        activeParkingId: p.traverse?.parkings[0]?.id ?? null,
        vehicleId: p.vehicleId ?? state.vehicleId,
        focusedTargetId: null,
        activePlan: action.active,
        notice: null,
      };
      // La huella se toma del estado ya abierto: recién abierto = sin cambios
      return { ...opened, activePlan: { ...action.active, signature: planSignature(opened) } };
    }
    case 'activePlanSet':
      // Recién guardado: lo que hay en pantalla es exactamente lo guardado
      return { ...state, activePlan: action.active && { ...action.active, signature: planSignature(state) } };
    case 'setProfile':
      return { ...state, profileId: action.id };
    case 'viewChanged': {
      let next = state;
      if (action.profile) {
        const profile = action.profile;
        const evaPlans = Object.fromEntries(
          Object.entries(state.evaPlans).map(([id, plan]) => [id, { ...plan, profile }]),
        );
        next = { ...next, traverseProfile: profile, evaPlans };
      }
      // Solo se abre una pantalla si lo que necesita ya está planificado
      const phase = action.phase;
      const allowed =
        phase === 'plan' ||
        (phase === 'walk' && !!next.traverse) ||
        (phase === 'go' && !!next.traverse && next.traverse.parkings.every((p) => next.evaPlans[p.id]));
      return phase && allowed ? { ...next, phase, tool: 'select', focusedTargetId: null } : next;
    }
  }
}
