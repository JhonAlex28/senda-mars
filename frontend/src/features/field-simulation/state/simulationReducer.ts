import type { Conditions, Hazard } from '@/features/route-planning';
import type { GeoPoint } from '@/shared/types/geo';
import { itineraryTotals, legEnd, sampleLeg, stopPoint, type Leg, type LegStop, type PlanTotals } from '../lib/itinerary';

export interface TaskProgress {
  targetId: string;
  doneMin: number;
  durationMin: number;
  resource: number;
}

export interface SimEvent {
  clock: number;
  icon: string;
  text: string;
}

export interface SimState {
  legs: Leg[];
  legIndex: number;
  t: number; // minutos de desplazamiento dentro del tramo actual
  nextStop: number; // índice en legs[legIndex].stops
  arrived: LegStop | null; // parada en la que estamos detenidos
  task: TaskProgress | null;
  running: boolean;
  speed: number; // minutos simulados por segundo real
  clock: number; // minutos simulados desde la salida
  battery: number; // kWh usados
  suitO2: number; // L usados en la caminata actual
  oxygen: number; // L usados en todas las caminatas
  roverDistance: number;
  walkDistance: number;
  completed: string[];
  skipped: string[];
  visited: string[];
  walksDone: number;
  conditions: Conditions;
  extraHazards: Hazard[];
  events: SimEvent[];
  /** Tramos ya recorridos que fueron reemplazados por una replanificación (para dibujar el rastro). */
  trail: GeoPoint[][];
  planned: PlanTotals;
  finished: boolean;
}

export type SimAction =
  | { type: 'tick'; seconds: number }
  | { type: 'setRunning'; running: boolean }
  | { type: 'setSpeed'; speed: number }
  | { type: 'beginTask' }
  | { type: 'completeTask' }
  | { type: 'skipStop' }
  | { type: 'continue' }
  | { type: 'replace'; legs: Leg[]; dropRest: boolean; skip?: string[]; note: string; icon: string }
  | { type: 'contingency'; hazard?: Hazard; conditions?: Conditions };

export const NOMINAL: Conditions = { speed_factor: 1, o2_multiplier: 1 };

export function initSimulation(legs: Leg[]): SimState {
  return {
    legs,
    legIndex: 0,
    t: 0,
    nextStop: 0,
    arrived: null,
    task: null,
    running: true,
    speed: 4,
    clock: 0,
    battery: 0,
    suitO2: 0,
    oxygen: 0,
    roverDistance: 0,
    walkDistance: 0,
    completed: [],
    skipped: [],
    visited: [],
    walksDone: 0,
    conditions: NOMINAL,
    extraHazards: [],
    events: [{ clock: 0, icon: 'rocket_launch', text: 'Left the base.' }],
    trail: [],
    planned: itineraryTotals(legs),
    finished: false,
  };
}

const log = (s: SimState, icon: string, text: string): SimEvent[] => [...s.events, { clock: s.clock, icon, text }];

/** Avanza el reloj: progreso de la tarea en curso o desplazamiento hasta la próxima parada. */
function tick(s: SimState, seconds: number): SimState {
  const minutes = seconds * s.speed;

  if (s.task) {
    const { task } = s;
    if (task.doneMin >= task.durationMin) return s;
    const done = Math.min(task.durationMin, task.doneMin + minutes);
    const used = (task.resource * (done - task.doneMin)) / task.durationMin;
    return {
      ...s,
      task: { ...task, doneMin: done },
      clock: s.clock + (done - task.doneMin),
      suitO2: s.suitO2 + used,
      oxygen: s.oxygen + used,
    };
  }
  if (!s.running || s.arrived || s.finished) return s;

  const leg = s.legs[s.legIndex];
  const stop = leg.stops[s.nextStop];
  const limit = stop ? stopPoint(leg, stop).t : legEnd(leg).t;
  const t = Math.min(s.t + minutes, limit);
  const before = sampleLeg(leg, s.t);
  const after = sampleLeg(leg, t);
  const dd = after.d - before.d;
  const dr = after.r - before.r;
  const rover = leg.mode === 'rover';

  const next: SimState = {
    ...s,
    t,
    clock: s.clock + (t - s.t),
    battery: rover ? s.battery + dr : s.battery,
    suitO2: rover ? s.suitO2 : s.suitO2 + dr,
    oxygen: rover ? s.oxygen : s.oxygen + dr,
    roverDistance: rover ? s.roverDistance + dd : s.roverDistance,
    walkDistance: rover ? s.walkDistance : s.walkDistance + dd,
  };
  if (t < limit) return next;
  if (!stop) return advanceLeg(next);
  return { ...next, arrived: stop, events: log(next, arrivalIcon(stop), arrivalText(stop)) };
}

function arrivalIcon(stop: LegStop): string {
  return { target: 'diamond', parking: 'local_parking', rover: 'airport_shuttle', base: 'home', waypoint: 'flag' }[stop.kind];
}

function arrivalText(stop: LegStop): string {
  switch (stop.kind) {
    case 'target':
      return `Reached ${stop.refId}.`;
    case 'parking':
      return `The rover stopped at ${stop.refId}.`;
    case 'rover':
      return 'Back at the rover.';
    case 'base':
      return 'Back at the base.';
    default:
      return 'Reached a waypoint.';
  }
}

/** Pasa al siguiente tramo (o termina la excursión si no quedan). */
function advanceLeg(s: SimState): SimState {
  const leg = s.legs[s.legIndex];
  const walksDone = leg.mode === 'eva' ? s.walksDone + 1 : s.walksDone;
  if (s.legIndex >= s.legs.length - 1) {
    return { ...s, walksDone, arrived: null, running: false, finished: true, events: log(s, 'flag', 'Mission complete.') };
  }
  const nextLeg = s.legs[s.legIndex + 1];
  const startsWalk = nextLeg.mode === 'eva';
  return {
    ...s,
    walksDone,
    legIndex: s.legIndex + 1,
    t: 0,
    nextStop: 0,
    arrived: null,
    suitO2: startsWalk ? 0 : s.suitO2,
    events: startsWalk ? log(s, 'directions_walk', `EVA started from ${nextLeg.parkingId}.`) : s.events,
  };
}

/** Deja atrás la parada actual y sigue el tramo (o pasa al siguiente si era la última). */
function leaveStop(s: SimState): SimState {
  const leg = s.legs[s.legIndex];
  const next = { ...s, arrived: null, task: null, nextStop: s.nextStop + 1 };
  return next.nextStop >= leg.stops.length && s.t >= legEnd(leg).t ? advanceLeg(next) : next;
}

export function simulationReducer(s: SimState, action: SimAction): SimState {
  switch (action.type) {
    case 'tick':
      return tick(s, action.seconds);
    case 'setRunning':
      return { ...s, running: action.running };
    case 'setSpeed':
      return { ...s, speed: action.speed };

    case 'beginTask': {
      const stop = s.arrived;
      if (!stop || stop.kind !== 'target' || s.task) return s;
      return {
        ...s,
        task: { targetId: stop.refId, doneMin: 0, durationMin: Math.max(stop.dwellMin, 0.1), resource: stop.dwellResource },
        events: log(s, 'science', `Science task started at ${stop.refId}.`),
      };
    }
    case 'completeTask': {
      if (!s.task || s.task.doneMin < s.task.durationMin) return s;
      const done = { ...s, completed: [...s.completed, s.task.targetId], events: log(s, 'task_alt', `Task done at ${s.task.targetId}.`) };
      return leaveStop(done);
    }
    case 'skipStop': {
      const stop = s.arrived;
      if (!stop || s.task) return s;
      return leaveStop({ ...s, skipped: [...s.skipped, stop.refId], events: log(s, 'skip_next', `Skipped ${stop.refId}.`) });
    }
    case 'continue': {
      const stop = s.arrived;
      if (!stop || stop.kind === 'target') return s;
      const visited = stop.kind === 'parking' ? [...s.visited, stop.refId] : s.visited;
      return leaveStop({ ...s, visited });
    }

    case 'replace': {
      // Sustituye lo que queda del tramo actual; con dropRest también descarta los siguientes (retornos)
      const rest = action.dropRest ? [] : s.legs.slice(s.legIndex + 1);
      const legs = [...s.legs.slice(0, s.legIndex), ...action.legs, ...rest];
      const old = s.legs[s.legIndex];
      const travelled = [...old.points.filter((p) => p.t < s.t), sampleLeg(old, s.t).point];
      return {
        ...s,
        legs,
        trail: [...s.trail, travelled],
        t: 0,
        nextStop: 0,
        arrived: null,
        task: null,
        running: true,
        skipped: [...s.skipped, ...(action.skip ?? [])],
        events: log(s, action.icon, action.note),
      };
    }
    case 'contingency':
      return {
        ...s,
        conditions: action.conditions ?? s.conditions,
        extraHazards: action.hazard ? [...s.extraHazards, action.hazard] : s.extraHazards,
      };
  }
}
