import { RouteComparator } from '@/features/route-planning';
import { Button } from '@/shared/ui/Button';
import { PlanningProgress } from '@/shared/ui/PlanningProgress';
import { Card } from '@/shared/ui/Card';
import { Icon } from '@/shared/ui/Icon';
import { goalTargetIds, usePlanning } from '../hooks/usePlanning';
import { activeParking, selectedTraverse } from '../state/selectors';
import { useMission } from '../state/MissionContext';
import { ErrorNote } from './ErrorNote';
import { ParkingChips } from './ParkingChips';
import { VehicleSelectorCard } from './VehicleSelectorCard';

/** Fase Plan: pedir la ruta del vehículo, comparar las tres opciones y elegir la parada. */
export function TraversePanel() {
  const { state, dispatch, targetById } = useMission();
  const { planTraverse, optimizeOrder, planEva, loading, loadingLabel, error, clearError } = usePlanning();
  const hasTargets = goalTargetIds(state).length > 0;
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

      {/* La ruta sigue el orden de la lista; "Optimize" la reordena con el recorrido eficiente */}
      <div className="flex gap-xs">
        <Button
          size="lg"
          icon="route"
          className="flex-1"
          disabled={!hasTargets || !!loading}
          loading={loading === 'traverse'}
          onClick={planTraverse}
          title={hasTargets ? 'Follows the list order' : 'Add a target first'}
        >
          {state.traverse ? 'Replan' : 'Plan route'}
        </Button>
        <Button
          size="lg"
          variant="secondary"
          icon="auto_fix_high"
          disabled={!hasTargets || state.goals.length < 2 || !!loading}
          loading={loading === 'optimize'}
          onClick={optimizeOrder}
          title="Best visit order"
        >
          Optimize
        </Button>
      </div>
      {loadingLabel && <PlanningProgress key={loading} label={loadingLabel} />}
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
