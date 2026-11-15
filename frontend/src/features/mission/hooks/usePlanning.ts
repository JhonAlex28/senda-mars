import { useState } from 'react';
import { routesApi, type TraversePlan } from '@/features/route-planning';
import { useMission } from '../state/MissionContext';
import type { MissionState } from '../state/types';

/** Objetivos científicos de la lista (sin waypoints), en su orden. */
export function goalTargetIds(state: MissionState): string[] {
  const wp = new Set(state.waypoints.map((w) => w.id));
  return state.goals.filter((g) => !wp.has(g));
}

/** Lista en el orden de visita de una ruta: objetivos de cada parada (en su orden previo) y waypoints. */
function goalsInVisitOrder(plan: TraversePlan, previous: string[]): string[] {
  const route = plan.routes[0];
  const byParking = new Map(plan.parkings.map((p) => [p.id, p.target_ids]));
  const rank = (id: string) => previous.indexOf(id);
  const ordered = route.stops.flatMap((s) => {
    if (s.kind === 'parking') return [...(byParking.get(s.ref_id) ?? [])].sort((a, b) => rank(a) - rank(b));
    if (s.kind === 'waypoint') return [s.ref_id];
    return [];
  });
  return [...ordered, ...previous.filter((g) => !ordered.includes(g))];
}

/** Acciones que llaman al planificador del backend, con su estado de carga y error. */
export function usePlanning() {
  const { state, dispatch } = useMission();
  const [loading, setLoading] = useState<string | null>(null); // 'traverse', 'optimize' o id del estacionamiento
  const [error, setError] = useState<string | null>(null);

  const run = async (key: string, task: () => Promise<void>) => {
    setLoading(key);
    setError(null);
    try {
      await task();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setLoading(null);
    }
  };

  // Sin speed_kmh: el backend usa la velocidad nominal del SEV (mission_params.json)
  const requestTraverse = (keepOrder: boolean) =>
    routesApi.traverse(state.base!, goalTargetIds(state), { hazards: state.hazards }, {
      vehicle_id: state.vehicleId,
      waypoints: state.waypoints,
      ...(keepOrder ? { order: state.goals } : {}),
    });

  /** Ruta en el orden de la lista (objetivos y waypoints). */
  const planTraverse = () =>
    run('traverse', async () => {
      if (!state.base) return;
      dispatch({ type: 'traversePlanned', plan: await requestTraverse(true) });
    });

  /** Orden eficiente del backend (vecino más cercano + 2-opt): reordena la lista y carga esa ruta. */
  const optimizeOrder = () =>
    run('optimize', async () => {
      if (!state.base) return;
      const plan = await requestTraverse(false);
      dispatch({ type: 'optimizedPlanned', plan, goals: goalsInVisitOrder(plan, state.goals) });
    });

  const planEva = (parkingId: string) =>
    run(parkingId, async () => {
      const parking = state.traverse?.parkings.find((p) => p.id === parkingId);
      if (!parking) return;
      const routes = await routesApi.eva(parking, parking.target_ids, { hazards: state.hazards });
      dispatch({ type: 'evaPlanned', parkingId, routes });
    });

  return { planTraverse, optimizeOrder, planEva, loading, error, clearError: () => setError(null) };
}
