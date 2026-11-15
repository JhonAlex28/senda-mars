import { RouteComparator } from '@/features/route-planning';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Icon } from '@/shared/ui/Icon';
import { usePlanning } from '../hooks/usePlanning';
import { activeParking, selectedTraverse } from '../state/selectors';
import { useMission } from '../state/MissionContext';
import { ErrorNote } from './ErrorNote';
import { ParkingChips } from './ParkingChips';
import { VehicleSelectorCard } from './VehicleSelectorCard';

/** Fase Plan: pedir la ruta del vehículo, comparar las tres opciones y elegir la parada. */
export function TraversePanel() {
  const { state, dispatch, targetById } = useMission();
  const { planTraverse, planEva, loading, error, clearError } = usePlanning();
  const parking = activeParking(state);
  const parkingPlanned = parking ? !!state.evaPlans[parking.id] : false;
  const activeRoute = selectedTraverse(state);

  const openWalk = async () => {
    if (!parking) return;
    if (!parkingPlanned) await planEva(parking.id);
    dispatch({ type: 'setPhase', phase: 'walk' });
  };

  return (
    <>
      <VehicleSelectorCard distanceM={activeRoute?.distance_m} driveMin={activeRoute?.duration_min} />

      <Button
        size="lg"
        icon="route"
        className="w-full"
        disabled={state.goals.length === 0}
        loading={loading === 'traverse'}
        onClick={planTraverse}
        title={state.goals.length === 0 ? 'Add a goal first' : undefined}
      >
        {state.traverse ? 'Replan route' : 'Plan route'}
      </Button>
      {error && <ErrorNote message={error} onClose={clearError} />}

      {state.traverse && (
        <>
          <RouteComparator
            title="Vehicle route"
            routes={state.traverse.routes}
            selected={state.traverseProfile}
            onSelect={(profile) => dispatch({ type: 'selectTraverseProfile', profile })}
          />

          <Card title="Stops" className="gap-xs">
            <div className="flex flex-wrap items-center justify-between gap-xs">
              <ParkingChips />
              <Button variant={parkingPlanned ? 'secondary' : 'primary'} size="sm" icon="directions_walk" loading={loading === parking?.id} onClick={openWalk}>
                {parkingPlanned ? 'Open EVA' : 'Plan EVA'}
              </Button>
            </div>
            {parking && (
              // key: al cambiar de estacionamiento, nodo nuevo para que el traductor lo vuelva a traducir
              <ul key={parking.id} className="flex flex-col gap-xs font-body text-body-sm text-on-surface-variant">
                {parking.target_ids.map((id) => (
                  <li key={id} className="flex items-start gap-xs">
                    <Icon name="diamond" className="mt-px shrink-0 text-[14px] text-accent" />
                    <span className="min-w-0 break-words">{targetById.get(id)?.name ?? id}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </>
  );
}
