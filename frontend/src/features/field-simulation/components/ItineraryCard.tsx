import { Card } from '@/shared/ui/Card';
import { Icon } from '@/shared/ui/Icon';
import { Meter } from '@/shared/ui/Meter';
import { Live } from '@/shared/ui/Text';
import { MODE_ICON, stopLabel } from '../lib/labels';
import type { SimState } from '../state/simulationReducer';

interface ItineraryCardProps {
  state: SimState;
  targetName: (id: string) => string | undefined;
}

/** Lista de tramos y paradas de la excursión con su estado (hecho, en curso, pendiente). */
export function ItineraryCard({ state, targetName }: ItineraryCardProps) {
  const totalTargets = state.planned.targets;
  return (
    <Card title="Trip plan" className="min-h-0 flex-1">
      <div className="flex flex-col gap-xs">
        <div className="flex justify-between font-body text-body-sm">
          <span className="text-on-surface-variant">Goals done</span>
          <Live className="font-mono text-mono-sm">
            {state.completed.length}/{totalTargets}
          </Live>
        </div>
        <Meter value={totalTargets ? (state.completed.length / totalTargets) * 100 : 0} tone="success" label="Goals done" />
      </div>

      <ol className="scroll-thin -mr-sm flex min-h-0 flex-col gap-xs overflow-y-auto pr-sm">
        {state.legs.map((leg, i) => {
          const status = i < state.legIndex || state.finished ? 'done' : i === state.legIndex ? 'current' : 'next';
          return (
            <li
              key={leg.id}
              className={`rounded-md border px-sm py-xs ${
                status === 'current' ? 'border-accent bg-surface' : 'border-outline-variant bg-surface/50'
              } ${status === 'done' ? 'opacity-60' : ''}`}
              aria-current={status === 'current' ? 'step' : undefined}
            >
              <p className="flex items-start gap-xs font-headline text-title-md">
                <Icon
                  name={status === 'done' ? 'check_circle' : MODE_ICON[leg.mode]}
                  filled={status === 'done'}
                  className={`mt-px shrink-0 text-[18px] ${status === 'done' ? 'text-success' : status === 'current' ? 'text-accent' : 'text-on-surface-variant'}`}
                />
                <span className="min-w-0 break-words">{leg.title}</span>
              </p>
              {leg.mode === 'eva' && (
                <ul className="ml-lg mt-xs flex flex-col gap-xs">
                  {leg.stops
                    .filter((s) => s.kind === 'target')
                    .map((s) => {
                      const done = state.completed.includes(s.refId);
                      const skipped = state.skipped.includes(s.refId);
                      return (
                        <li key={s.refId} className={`flex items-start gap-xs font-body text-body-sm ${skipped ? 'line-through opacity-50' : ''}`}>
                          <Icon
                            name={done ? 'task_alt' : skipped ? 'block' : 'radio_button_unchecked'}
                            className={`mt-px shrink-0 text-[14px] ${done ? 'text-success' : 'text-on-surface-variant'}`}
                          />
                          <span className="min-w-0 break-words">{stopLabel(s, targetName)}</span>
                        </li>
                      );
                    })}
                </ul>
              )}
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
