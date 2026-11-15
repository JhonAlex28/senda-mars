import { useEffect, useMemo, useReducer, useState } from 'react';
import { safetyApi, type EngineAlert, type ScenarioInfo, type SimRoute, type SimRow } from '@/features/safety';
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

export type ContingencyKind = 'blocked' | 'dust' | 'leak' | 'injury' | 'sep';

interface ContingencyDef {
  title: string;
  text: string;
  icon: string;
  /** Escenario del motor de seguridad (GET /scenarios). */
  scenario: ScenarioInfo['id'];
  /** Condiciones para replanificar (mismos factores que env.json / mission_params.json). */
  conditions?: Partial<Conditions>;
  evaOnly?: boolean;
}

export const CONTINGENCIES: Record<ContingencyKind, ContingencyDef> = {
  blocked: { title: 'Path blocked', text: 'Rocks or sand ahead.', icon: 'block', scenario: 'blocked_path' },
  dust: { title: 'Dust storm', text: '30% slower.', icon: 'storm', scenario: 'dust_storm', conditions: { speed_factor: 0.7 } },
  leak: { title: 'Suit leak', text: '+50% O₂ use.', icon: 'heat_pump', scenario: 'suit_leak', conditions: { o2_multiplier: 1.5 }, evaOnly: true },
  injury: { title: 'Crew injury', text: 'Half speed.', icon: 'personal_injury', scenario: 'injury', conditions: { speed_factor: 0.5 }, evaOnly: true },
  sep: { title: 'Solar particle event', text: 'Return now.', icon: 'flare', scenario: 'sep_event', evaOnly: true },
};

/** Ruta del tramo EVA en el formato de /simulate (lon/lat y paradas en objetivos). */
function simRoute(leg: Leg): SimRoute {
  return {
    profile: leg.profile,
    path: leg.points.map((p) => ({ lon: p.lon, lat: p.lat })),
    stops: leg.stops.filter((x) => x.kind === 'target').map((x) => ({ target_id: x.refId, path_index: x.index })),
  };
}

/** Índice del último punto del tramo ya alcanzado en el minuto t. */
function pointIndexAt(leg: Leg, t: number): number {
  let i = 0;
  while (i < leg.points.length - 1 && leg.points[i + 1].t <= t) i++;
  return i;
}

/** Primera alerta de seguridad (rtb antes que caution) a partir de `progress`. */
function firstAlert(rows: SimRow[], progress: number): EngineAlert | null {
  const ahead = rows.filter((r) => r.progress >= progress - 1e-6 && r.alert && r.alert.level !== 'info');
  return ahead.find((r) => r.alert!.level === 'rtb')?.alert ?? ahead[0]?.alert ?? null;
}

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
  const [engineAlert, setEngineAlert] = useState<EngineAlert | null>(null);
  const [available, setAvailable] = useState<Set<string> | null>(null);
  const [nominal, setNominal] = useState<{ legId: string; rows: SimRow[] } | null>(null);

  // Escenarios que ofrece el motor (si no responde, se muestran todos)
  useEffect(() => {
    safetyApi.scenarios().then((list) => setAvailable(new Set(list.map((x) => x.id)))).catch(() => setAvailable(null));
  }, []);

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

  // EVA nominal: el motor da la reserva de retorno y las alertas (PNR, ventana EVA…) a lo largo de la ruta
  useEffect(() => {
    if (leg.mode !== 'eva') return;
    let cancelled = false;
    safetyApi
      .simulate(simRoute(leg), 'none', 0)
      .then((r) => !cancelled && setNominal({ legId: leg.id, rows: r.timeline }))
      .catch(() => !cancelled && setNominal(null));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leg.id]);

  const total = legEnd(leg).d || 1;
  const progress = here.d / total;
  const liveSafety = useMemo(() => {
    if (leg.mode !== 'eva' || !nominal || nominal.legId !== leg.id || nominal.rows.length === 0) return null;
    const row = [...nominal.rows].reverse().find((r) => r.progress <= progress + 1e-6) ?? nominal.rows[0];
    const alert = row.alert && row.alert.level !== 'info' ? row.alert : null;
    return { reserveL: row.reserve_L, alert };
  }, [leg, nominal, progress]);

  const options = (Object.keys(CONTINGENCIES) as ContingencyKind[]).filter(
    (k) => (!CONTINGENCIES[k].evaOnly || leg.mode === 'eva') && (!available || available.has(CONTINGENCIES[k].scenario)),
  );

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

      const def = CONTINGENCIES[kind];
      let hazard: Hazard | undefined;
      const conditions: Conditions = { ...s.conditions, ...def.conditions };
      if (kind === 'blocked') {
        const { ahead, radius } = BLOCK[current.mode];
        const center = pointAhead(current, here.d, ahead, Math.max(here.d, nextStopD - radius * 1.5));
        hazard = { ...center, radius_m: radius };
      }

      // En EVA, el motor de seguridad decide: reproduce el escenario desde aquí y da alertas y desvío
      if (current.mode === 'eva' && kind !== 'blocked') {
        const at = pointIndexAt(current, s.t);
        const sim = await safetyApi.simulate(simRoute(current), def.scenario, at);
        const alert = firstAlert(sim.timeline, at / Math.max(1, current.points.length - 1));
        setEngineAlert(alert);
        dispatch({ type: 'contingency', conditions });
        if (sim.diversion || alert?.level === 'rtb' || kind === 'sep') {
          await walkBack(s, conditions, `${def.title}: ${alert?.msg ?? 'return to the vehicle.'}`, 'warning');
          return;
        }
      }

      const before = legRemaining(current, s.t, s.nextStop);
      const route = await plan(
        current.mode,
        [fromHere(s), ...pending.map((p) => stopWaypoint(current, p))],
        current.profile,
        { hazards: [...hazards, ...s.extraHazards, ...(hazard ? [hazard] : [])], conditions },
      );
      const replanned = legFromRoute(route, { id: `${current.id}-r${s.events.length}`, title: current.title, parkingId: current.parkingId, waypointId: current.waypointId });
      const after = legRemaining(replanned, 0, 0);

      dispatch({ type: 'contingency', hazard, conditions });
      dispatch({ type: 'replace', legs: [replanned], dropRest: false, note: `${def.title}. New route.`, icon: 'alt_route' });
      setLastReplan({
        title: def.title,
        minutesDelta: after.minutes - before.minutes,
        distanceDelta: after.distance - before.distance,
        resourceDelta: ((after.resource - before.resource) / current.capacity) * 100,
        mode: current.mode,
      });
    });

  /** EVA: deja los objetivos pendientes y vuelve al vehículo por la ruta segura. */
  async function walkBack(s: SimState, conditions: Conditions, note: string, icon: string) {
    const current = s.legs[s.legIndex];
    const roverStop = current.stops[current.stops.length - 1];
    const skip = current.stops.slice(s.nextStop, -1).map((p) => p.refId).filter((id) => !s.completed.includes(id));
    const route = await plan('eva', [fromHere(s), stopWaypoint(current, roverStop)], 'safe', {
      hazards: [...hazards, ...s.extraHazards],
      conditions,
    });
    const back = legFromRoute(route, { id: `${current.id}-back${s.events.length}`, title: 'Walk to the vehicle', parkingId: current.parkingId });
    dispatch({ type: 'replace', legs: [back], dropRest: false, skip, note, icon });
  }

  /** Durante una EVA: dejar los objetivos pendientes y volver al vehículo. */
  const returnToRover = () => run('rover', () => walkBack(state, state.conditions, 'Heading to the vehicle.', 'airport_shuttle'));

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
        newLegs.push(legFromRoute(walk, { id: `${current.id}-home`, title: 'Walk to the vehicle', parkingId: current.parkingId }));
      }
      const drive = await plan('rover', [{ ...roverAt, kind: 'waypoint', ref_id: '' }, baseWp], 'safe', scenario);
      newLegs.push(legFromRoute(drive, { id: 'drive-home', title: 'Drive to base', parkingId: null }));

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
    contingencyOptions: options,
    engineAlert,
    clearEngineAlert: () => setEngineAlert(null),
    liveSafety,
    returnToRover,
    returnToBase,
  };
}

export type Simulation = ReturnType<typeof useSimulation>;
