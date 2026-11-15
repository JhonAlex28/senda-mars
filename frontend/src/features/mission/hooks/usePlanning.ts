import { useState } from 'react';
import { routesApi } from '@/features/route-planning';
import { useMission } from '../state/MissionContext';

/** Acciones que llaman al planificador del backend, con su estado de carga y error. */
export function usePlanning() {
  const { state, dispatch } = useMission();
  const [loading, setLoading] = useState<string | null>(null); // 'traverse' o id del estacionamiento
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

  const planTraverse = () =>
    run('traverse', async () => {
      if (!state.base) return;
      // Sin speed_kmh: el backend usa la velocidad nominal del SEV (mission_params.json)
      const plan = await routesApi.traverse(state.base, state.goals, { hazards: state.hazards }, {
        vehicle_id: state.vehicleId,
        waypoints: state.waypoints,
      });
      dispatch({ type: 'traversePlanned', plan });
    });

  const planEva = (parkingId: string) =>
    run(parkingId, async () => {
      const parking = state.traverse?.parkings.find((p) => p.id === parkingId);
      if (!parking) return;
      const routes = await routesApi.eva(parking, parking.target_ids, { hazards: state.hazards });
      dispatch({ type: 'evaPlanned', parkingId, routes });
    });

  return { planTraverse, planEva, loading, error, clearError: () => setError(null) };
}
