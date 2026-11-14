import { Fragment } from 'react';
import { RouteComparator } from '@/features/route-planning';
import { Live } from '@/shared/ui/Text';
import { formatMinutes } from '@/shared/lib/format';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Icon } from '@/shared/ui/Icon';
import { usePlanning } from '../hooks/usePlanning';
import { activeParking, selectedEva } from '../state/selectors';
import { useMission } from '../state/MissionContext';
import { ErrorNote } from './ErrorNote';
import { ParkingChips } from './ParkingChips';

/** Fase Walk: desde cada estacionamiento, planificar la caminata a los objetivos cercanos. */
export function EvaPanel() {
  const { state, dispatch, targetById } = useMission();
  const { planEva, loading, error, clearError } = usePlanning();
  const parking = activeParking(state);
  if (!state.traverse || !parking) return null;

  const plan = state.evaPlans[parking.id];
  const walk = selectedEva(state, parking.id);
  const nextUnplanned = state.traverse.parkings.find((p) => !state.evaPlans[p.id] && p.id !== parking.id);

  return (
    // key: al cambiar de estacionamiento se crean nodos nuevos y el traductor los vuelve a traducir
    <Fragment key={parking.id}>
      <Card title={`Walk from ${parking.id}`} action={<ParkingChips />} className="gap-xs">
        <ul className="flex flex-col gap-xs">
          {parking.target_ids.map((id) => {
            const t = targetById.get(id);
            return (
              <li key={id} className="flex items-center justify-between gap-sm rounded-md border border-outline bg-surface px-sm py-xs font-body text-body-sm">
                <span className="flex min-w-0 items-center gap-xs">
                  <Icon name="diamond" className="text-[16px] text-accent" />
                  <span className="truncate">{t?.name ?? id}</span>
                </span>
                <Live className="shrink-0 font-mono text-mono-sm text-on-surface-variant">
                  🔬 {formatMinutes(t?.task?.duration_min ?? 0)}
                </Live>
              </li>
            );
          })}
        </ul>
        {!plan && (
          <Button variant="secondary" icon="directions_walk" loading={loading === parking.id} onClick={() => planEva(parking.id)}>
            Plan EVA route
          </Button>
        )}
        {error && <ErrorNote message={error} onClose={clearError} />}
      </Card>

      {plan && walk && (
        <>
          <RouteComparator
            title="Pick a walking path"
            routes={plan.routes}
            selected={plan.profile}
            onSelect={(profile) => dispatch({ type: 'selectEvaProfile', parkingId: parking.id, profile })}
          />
          <Card key={plan.profile} className="items-center gap-xs text-center">
            <p className="flex flex-wrap justify-center gap-x-md font-body text-body-sm text-on-surface-variant">
              <span>
                Walk time: <Live className="font-mono text-mono-sm text-on-surface">{formatMinutes(walk.duration_min)}</Live>
              </span>
              <span>
                Oxygen left: <Live className="font-mono text-mono-sm text-on-surface">{Math.round(walk.resource.remaining_pct)}%</Live>
              </span>
            </p>
            <p className={`font-body text-body-sm ${walk.return_ok ? 'text-accent' : 'text-error'}`}>
              {walk.return_ok ? 'We can walk back to the rover.' : 'It is too far. There is not enough oxygen to come back safely.'}
            </p>
          </Card>
          {nextUnplanned && (
            <Button
              variant="ghost"
              icon="arrow_forward"
              onClick={async () => {
                dispatch({ type: 'selectParking', id: nextUnplanned.id });
                await planEva(nextUnplanned.id);
              }}
            >
              Plan the next stop: {nextUnplanned.id}
            </Button>
          )}
        </>
      )}
    </Fragment>
  );
}
