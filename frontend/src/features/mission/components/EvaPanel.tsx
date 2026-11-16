import { Fragment } from 'react';
import { RouteComparator } from '@/features/route-planning';
import { SCIENCE_TYPES, scienceType } from '@/features/targets';
import { Live } from '@/shared/ui/Text';
import { formatMinutes } from '@/shared/lib/format';
import { Button } from '@/shared/ui/Button';
import { PlanningProgress } from '@/shared/ui/PlanningProgress';
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
  const { planEva, loading, loadingLabel, error, clearError } = usePlanning();
  const parking = activeParking(state);
  if (!state.traverse || !parking) return null;

  const plan = state.evaPlans[parking.id];
  const walk = selectedEva(state, parking.id);
  const nextUnplanned = state.traverse.parkings.find((p) => !state.evaPlans[p.id] && p.id !== parking.id);

  return (
    // key: al cambiar de estacionamiento se crean nodos nuevos y el traductor los vuelve a traducir
    <Fragment key={parking.id}>
      <Card title={`EVA · ${parking.id}`} action={<ParkingChips />} className="gap-xs">
        <ul className="flex flex-col gap-xs">
          {parking.target_ids.map((id) => {
            const t = targetById.get(id);
            return (
              <li key={id} className="flex items-center justify-between gap-sm rounded-md border border-outline bg-surface px-sm py-xs font-body text-body-sm">
                <span className="flex min-w-0 items-center gap-xs">
                  <Icon name={t ? SCIENCE_TYPES[scienceType(t)].icon : 'diamond'} className="text-[16px] text-accent" />
                  <span className="min-w-0 break-words">{t?.name ?? id}</span>
                </span>
                <Live className="shrink-0 font-mono text-mono-sm text-on-surface-variant">
                  {formatMinutes(t?.task?.duration_min ?? 0)}
                </Live>
              </li>
            );
          })}
        </ul>
        {!plan && (
          <Button icon="directions_walk" loading={loading === parking.id} onClick={() => planEva(parking.id)}>
            Plan EVA
          </Button>
        )}
        {loadingLabel && <PlanningProgress key={loading} label={loadingLabel} />}
        {error && <ErrorNote message={error} onClose={clearError} />}
      </Card>

      {plan && walk && (
        <>
          <RouteComparator
            title="EVA route"
            routes={plan.routes}
            selected={plan.profile}
            onSelect={(profile) => dispatch({ type: 'selectEvaProfile', parkingId: parking.id, profile })}
          />
          {nextUnplanned && (
            <Button
              icon="arrow_forward"
              onClick={async () => {
                dispatch({ type: 'selectParking', id: nextUnplanned.id });
                await planEva(nextUnplanned.id);
              }}
            >
              Next: {nextUnplanned.id}
            </Button>
          )}
        </>
      )}
    </Fragment>
  );
}
