import type { MissionAction, MissionState } from './types';

export const initialMissionState: MissionState = {
  phase: 'globe',
  missionId: 'mount-sharp',
  base: null,
  goals: [],
  hazards: [],
  tool: 'select',
  focusedTargetId: null,
  traverse: null,
  traverseProfile: 'safe',
  activeParkingId: null,
  evaPlans: {},
  vehicleId: 'SEV_PRESSURIZED',
  vehicleSpeedKmh: 8.0,
  crew: {
    teamName: 'SENDA-ARES CREW',
    members: [
      { id: 'EVA-1', name: 'WATNEY', role: 'CDR', suitId: 'xEMU-01', restingBpm: 68, massKg: 78 },
      { id: 'EVA-2', name: 'LEWIS', role: 'GEO', suitId: 'xEMU-02', restingBpm: 64, massKg: 68 },
    ],
  },
  env: { tau: 0.62, lmstHour: 13, speActive: false },
  quantumSummary: null,
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
    notice: `${reason} Find the rover routes again.`,
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

    case 'initBase':
      return state.base ? state : { ...state, base: action.point };
    case 'moveBase':
      return invalidatePlan({ ...state, base: action.point }, 'The base moved.');

    case 'toggleGoal': {
      const has = state.goals.includes(action.id);
      const goals = has ? state.goals.filter((g) => g !== action.id) : [...state.goals, action.id];
      return invalidatePlan({ ...state, goals }, 'Your goals changed.');
    }
    case 'moveGoal':
      if (action.to < 0 || action.to >= state.goals.length) return state;
      return invalidatePlan({ ...state, goals: move(state.goals, action.from, action.to) }, 'Your goal order changed.');
    case 'focusTarget':
      return { ...state, focusedTargetId: action.id };

    case 'addHazard':
      return invalidatePlan({ ...state, hazards: [...state.hazards, action.hazard] }, 'You marked a new danger zone.');
    case 'removeHazard':
      return invalidatePlan(
        { ...state, hazards: state.hazards.filter((_, i) => i !== action.index) },
        'A danger zone was removed.',
      );
    case 'clearHazards':
      return invalidatePlan({ ...state, hazards: [] }, 'Danger zones were cleared.');
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

    case 'setVehicle':
      return { ...state, vehicleId: action.vehicleId };
    case 'setVehicleSpeed':
      return { ...state, vehicleSpeedKmh: action.speedKmh };
    case 'setCrew':
      return { ...state, crew: action.crew };
    case 'setEnv':
      return { ...state, env: { ...state.env, ...action.env } };
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
        notice: 'Quick Demo loaded (3 Gale Crater science targets). Click "Find Rover Routes" to compute traverse!',
      };
    case 'resetMission':
      return {
        ...initialMissionState,
        phase: 'plan',
        base: state.base,
        crew: state.crew,
        notice: 'Mission reset. Select science targets or click Quick Demo.',
      };

    case 'dismissNotice':
      return { ...state, notice: null };

    case 'planLoaded':
      return {
        ...state,
        phase: 'walk',
        tool: 'select',
        goals: action.goals,
        hazards: action.hazards,
        traverse: action.traverse,
        traverseProfile: action.traverseProfile,
        evaPlans: action.evaPlans,
        activeParkingId: action.traverse.parkings[0]?.id ?? null,
        focusedTargetId: null,
        notice: null,
      };
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
