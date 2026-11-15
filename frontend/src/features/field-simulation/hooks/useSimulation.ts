import { useEffect, useReducer, useState } from 'react';
import { routesApi, type Conditions, type Hazard, type RouteProfile, type TravelMode, type Waypoint } from '@/features/route-planning';
import type { GeoPoint } from '@/shared/types/geo';
import {
  legEnd,
  legFromRoute,
  legRemaining,
  pointAhead,
  sampleLeg,
  stopPoint,
  stopWaypoint,
  type Leg,
} from '../lib/itinerary';
import { initSimulation, simulationReducer, type SimState } from '../state/simulationReducer';

const TICK_MS = 100;

export type ContingencyKind = 'blocked' | 'dust' | 'leak';

export const CONTINGENCIES: Record<ContingencyKind, { title: string; text: string; icon: string; evaOnly?: boolean }> = {
  blocked: { title: 'The path is blocked', text: 'Fallen rocks or deep sand block the way ahead.', icon: 'block' },
  dust: { title: 'Dust storm', text: 'It is hard to see. Everyone moves 30% slower.', icon: 'storm' },
  leak: { title: 'Leak in the suit', text: 'The suit uses 50% more oxygen.', icon: 'heat_pump', evaOnly: true },
};

const BLOCK = { rover: { ahead: 150, radius: 45 }, eva: { ahead: 25, radius: 6 } } as const;

interface Scenario {
  hazards: Hazard[];
  conditions: Conditions;
}

/** Una sola ruta (el perfil indicado) desde la posición actual por los waypoints dados. */
async function plan(mode: TravelMode, waypoints: Waypoint[], profile: RouteProfile, scenario: Scenario) {
  const [route] = await routesApi.path(mode, waypoints, scenario, [profile]);
  return route;
}

interface SimulationInput {
  legs: Leg[];
  base: GeoPoint;
  hazards: Hazard[];
}

export interface ReplanResult {
  title: string;
  minutesDelta: number;
  distanceDelta: number;
  resourceDelta: number; // puntos porcentuales de la capacidad
  mode: TravelMode;
}

/** Ejecución simulada: reloj, llegada a paradas, tareas, contingencias y retornos. */
export function useSimulation({ legs, base, hazards }: SimulationInput) {
  const [state, dispatch] = useReducer(simulationReducer, legs, initSimulation);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastReplan, setLastReplan] = useState<ReplanResult | null>(null);

  const ticking = state.task ? state.task.doneMin < state.task.durationMin : state.running && !state.arrived && !state.finished;
  useEffect(() => {
    if (!ticking) return;
    let last = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      dispatch({ type: 'tick', seconds: (now - last) / 1000 });
      last = now;
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [ticking]);

  const leg = state.legs[state.legIndex];
  const here = sampleLeg(leg, state.t);

  /** Pausa, calcula la nueva ruta y reanuda (si falla, se queda en pausa con el error visible). */
  const run = async (key: string, task: () => Promise<void>) => {
    dispatch({ type: 'setRunning', running: false });
    setBusy(key);
    setError(null);
    try {
      await task();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not compute a new route.');
    } finally {
      setBusy(null);
    }
  };

  const fromHere = (s: SimState): Waypoint => ({ ...sampleLeg(s.legs[s.legIndex], s.t).point, kind: 'waypoint', ref_id: '' });

  const triggerContingency = (kind: ContingencyKind) =>
    run(kind, async () => {
      const s = state;
      const current = s.legs[s.legIndex];
      const pending = current.stops.slice(s.nextStop);
      const nextStopD = pending.length ? stopPoint(current, pending[0]).d : legEnd(current).d;

      let hazard: Hazard | undefined;
      let conditions = s.conditions;
      if (kind === 'blocked') {
        const { ahead, radius } = BLOCK[current.mode];
        const center = pointAhead(current, here.d, ahead, Math.max(here.d, nextStopD - radius * 1.5));
        hazard = { ...center, radius_m: radius };
      } else if (kind === 'dust') {
        conditions = { ...conditions, speed_factor: 0.7 };
      } else {
        conditions = { ...conditions, o2_multiplier: 1.5 };
      }

      const before = legRemaining(current, s.t, s.nextStop);
      const route = await plan(
        current.mode,
        [fromHere(s), ...pending.map((p) => stopWaypoint(current, p))],
        current.profile,
        { hazards: [...hazards, ...s.extraHazards, ...(hazard ? [hazard] : [])], conditions },
      );
      const replanned = legFromRoute(route, { id: `${current.id}-r${s.events.length}`, title: current.title, parkingId: current.parkingId });
      const after = legRemaining(replanned, 0, 0);

      dispatch({ type: 'contingency', hazard, conditions });
      dispatch({ type: 'replace', legs: [replanned], dropRest: false, note: `${CONTINGENCIES[kind].title}. New route found.`, icon: 'alt_route' });
      setLastReplan({
        title: CONTINGENCIES[kind].title,
        minutesDelta: after.minutes - before.minutes,
        distanceDelta: after.distance - before.distance,
        resourceDelta: ((after.resource - before.resource) / current.capacity) * 100,
        mode: current.mode,
      });
    });

  /** Durante una EVA: dejar los objetivos pendientes y volver al rover. */
  const returnToRover = () =>
    run('rover', async () => {
      const s = state;
      const current = s.legs[s.legIndex];
      const roverStop = current.stops[current.stops.length - 1];
      const skip = current.stops.slice(s.nextStop, -1).map((p) => p.refId).filter((id) => !s.completed.includes(id));
      const route = await plan('eva', [fromHere(s), stopWaypoint(current, roverStop)], 'safe', {
        hazards: [...hazards, ...s.extraHazards],
        conditions: s.conditions,
      });
      const back = legFromRoute(route, { id: `${current.id}-back`, title: 'Walk back to the rover', parkingId: current.parkingId });
      dispatch({ type: 'replace', legs: [back], dropRest: false, skip, note: 'Heading back to the rover.', icon: 'airport_shuttle' });
    });

  /** Terminar antes: volver a la base desde donde estemos (pasando por el rover si estamos a pie). */
  const returnToBase = () =>
    run('base', async () => {
      const s = state;
      const current = s.legs[s.legIndex];
      const scenario = { hazards: [...hazards, ...s.extraHazards], conditions: s.conditions };
      const baseWp: Waypoint = { ...base, kind: 'base', ref_id: 'base' };
      const pendingTargets = s.legs
        .slice(s.legIndex)
        .flatMap((l) => l.stops.filter((p) => p.kind === 'target').map((p) => p.refId))
        .filter((id) => !s.completed.includes(id) && !s.skipped.includes(id));
      const newLegs: Leg[] = [];

      let roverAt: Waypoint = fromHere(s);
      if (current.mode === 'eva') {
        const roverStop = current.stops[current.stops.length - 1];
        roverAt = stopWaypoint(current, roverStop);
        const walk = await plan('eva', [fromHere(s), roverAt], 'safe', scenario);
        newLegs.push(legFromRoute(walk, { id: `${current.id}-home`, title: 'Walk back to the rover', parkingId: current.parkingId }));
      }
      const drive = await plan('rover', [{ ...roverAt, kind: 'waypoint', ref_id: '' }, baseWp], 'safe', scenario);
      newLegs.push(legFromRoute(drive, { id: 'drive-home', title: 'Drive back to base', parkingId: null }));

      dispatch({ type: 'replace', legs: newLegs, dropRest: true, skip: pendingTargets, note: 'Returning to base early.', icon: 'home' });
    });

  return {
    state,
    leg,
    here,
    dispatch,
    busy,
    error,
    clearError: () => setError(null),
    lastReplan,
    clearReplan: () => setLastReplan(null),
    triggerContingency,
    returnToRover,
    returnToBase,
  };
}

export type Simulation = ReturnType<typeof useSimulation>;
