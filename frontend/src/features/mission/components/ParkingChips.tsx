import { Icon } from '@/shared/ui/Icon';
import { useMission } from '../state/MissionContext';

/** Selector de puntos de estacionamiento (P1, P2…) con marca de "caminata planificada". */
export function ParkingChips() {
  const { state, dispatch } = useMission();
  if (!state.traverse) return null;

  return (
    <div className="flex flex-wrap items-center gap-xs" role="tablist" aria-label="Vehicle stops">
      {state.traverse.parkings.map((p) => {
        const active = p.id === state.activeParkingId;
        const planned = !!state.evaPlans[p.id];
        return (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => dispatch({ type: 'selectParking', id: p.id })}
            className={`inline-flex items-center gap-xs rounded px-sm py-xs font-headline text-label-sm transition-colors ${
              active ? 'bg-primary text-on-primary' : 'border border-outline bg-surface text-on-surface hover:border-accent'
            }`}
          >
            {p.id}
            {planned && <Icon name="check_circle" filled className={`text-[14px] ${active ? '' : 'text-success'}`} />}
          </button>
        );
      })}
    </div>
  );
}
