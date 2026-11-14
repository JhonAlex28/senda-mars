import { formatDistance, formatMinutes } from '@/shared/lib/format';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { Meter } from '@/shared/ui/Meter';
import type { SimState } from '../state/simulationReducer';

interface MissionSummaryProps {
  state: SimState;
  roverCapacity: number;
  targetName: (id: string) => string | undefined;
  onReplan: () => void;
  onExit: () => void;
}

interface Row {
  icon: string;
  label: string;
  actual: string;
  planned: string;
  ratio?: number; // real / planificado, para la barra
}

/** Resumen final: lo realizado frente a lo planificado. */
export function MissionSummary({ state, roverCapacity, targetName, onReplan, onExit }: MissionSummaryProps) {
  const { planned } = state;
  const parkings = new Set(state.legs.map((l) => l.parkingId).filter(Boolean)).size;
  const rows: Row[] = [
    { icon: 'airport_shuttle', label: 'Rover drive', actual: formatDistance(state.roverDistance), planned: formatDistance(planned.roverDistance), ratio: state.roverDistance / planned.roverDistance },
    { icon: 'local_parking', label: 'Parking spots visited', actual: `${state.visited.length}`, planned: `${parkings}` },
    { icon: 'directions_walk', label: 'EVA walks', actual: `${state.walksDone} · ${formatDistance(state.walkDistance)}`, planned: formatDistance(planned.walkDistance) },
    { icon: 'diamond', label: 'Science goals done', actual: `${state.completed.length}`, planned: `${planned.targets}`, ratio: state.completed.length / Math.max(planned.targets, 1) },
    { icon: 'schedule', label: 'Simulated time', actual: formatMinutes(state.clock), planned: formatMinutes(planned.minutes), ratio: state.clock / planned.minutes },
    { icon: 'battery_charging_full', label: 'Rover battery used', actual: `${state.battery.toFixed(1)} kWh (${Math.round((state.battery / roverCapacity) * 100)}%)`, planned: `${planned.battery.toFixed(1)} kWh`, ratio: state.battery / planned.battery },
    { icon: 'air', label: 'Oxygen used (all EVAs)', actual: `${Math.round(state.oxygen)} L`, planned: `${Math.round(planned.oxygen)} L`, ratio: state.oxygen / Math.max(planned.oxygen, 1) },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface/80 p-md backdrop-blur-sm">
      <section className="flex max-h-full w-full max-w-2xl animate-fade-up flex-col gap-md overflow-y-auto rounded-lg border-2 border-success/60 bg-surface-container p-lg shadow-2xl" aria-label="Mission summary">
        <header className="flex items-center gap-md">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success text-on-success">
            <Icon name="flag" className="text-[28px]" />
          </div>
          <div>
            <h2 className="font-headline text-headline-lg uppercase">Trip complete</h2>
            <p className="font-body text-body-sm text-on-surface-variant">Here is what you did, next to what you planned.</p>
          </div>
        </header>

        <table className="w-full border-separate border-spacing-y-xs">
          <thead>
            <tr className="font-label text-label-sm uppercase text-on-surface-variant">
              <th className="text-left font-semibold">What</th>
              <th className="text-right font-semibold">Done</th>
              <th className="text-right font-semibold">Planned</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="bg-surface">
                <td className="rounded-l-md px-sm py-xs">
                  <span className="flex items-center gap-sm font-body text-body-md">
                    <Icon name={r.icon} className="text-[18px] text-accent" />
                    {r.label}
                  </span>
                  {r.ratio !== undefined && (
                    <Meter value={Math.min(r.ratio, 1) * 100} tone={r.ratio > 1.05 ? 'warning' : 'success'} label={r.label} className="mt-xs h-1" />
                  )}
                </td>
                <td className="px-sm py-xs text-right font-mono text-mono-md text-on-surface">{r.actual}</td>
                <td className="rounded-r-md px-sm py-xs text-right font-mono text-mono-md text-on-surface-variant">{r.planned}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {(state.completed.length > 0 || state.skipped.length > 0) && (
          <div className="flex flex-wrap gap-xs">
            {state.completed.map((id) => (
              <span key={id} className="inline-flex items-center gap-xs rounded-full bg-success/15 px-sm py-xs font-body text-body-sm text-success">
                <Icon name="task_alt" className="text-[14px]" /> {targetName(id) ?? id}
              </span>
            ))}
            {state.skipped.map((id) => (
              <span key={id} className="inline-flex items-center gap-xs rounded-full bg-surface-container-high px-sm py-xs font-body text-body-sm text-on-surface-variant line-through">
                {targetName(id) ?? id}
              </span>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-sm">
          <Button variant="ghost" icon="public" onClick={onExit}>
            View Mars
          </Button>
          <Button icon="edit_road" onClick={onReplan}>
            Plan another trip
          </Button>
        </div>
      </section>
    </div>
  );
}
