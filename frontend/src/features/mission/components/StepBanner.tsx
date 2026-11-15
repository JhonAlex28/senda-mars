import { Icon } from '@/shared/ui/Icon';
import { planStep } from '../state/selectors';
import { useMission } from '../state/MissionContext';
import type { PlanStep } from '../state/types';

const STEPS: { step: PlanStep; label: string; icon: string }[] = [
  { step: 'goals', label: 'Goals', icon: 'diamond' },
  { step: 'traverse', label: 'Rover', icon: 'route' },
  { step: 'eva', label: 'Spacewalks', icon: 'directions_walk' },
  { step: 'ready', label: 'Start', icon: 'rocket_launch' },
];

/** Guía paso a paso sobre el mapa: dónde estoy y qué hago ahora. */
export function StepBanner() {
  const { state } = useMission();
  const current = planStep(state);
  const index = STEPS.findIndex((s) => s.step === current);

  return (
    <div className="pointer-events-none absolute left-1/2 top-md z-30 flex w-[min(560px,calc(100%-2rem))] -translate-x-1/2 flex-col gap-xs rounded-lg border border-accent/50 bg-surface-container/95 px-md py-sm shadow-xl backdrop-blur">
      <ol className="flex items-center justify-between gap-xs" aria-label="Planning steps">
        {STEPS.map((s, i) => (
          <li key={s.step} className="flex flex-1 items-center gap-xs last:flex-none">
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[14px] ${
                i < index ? 'bg-success text-on-success' : i === index ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface-variant'
              }`}
              aria-current={i === index ? 'step' : undefined}
            >
              <Icon name={i < index ? 'check' : s.icon} className="text-[14px]" />
            </span>
            <span className={`hidden truncate font-label text-label-sm uppercase lg:inline ${i === index ? 'text-on-surface' : 'text-on-surface-variant'}`}>{s.label}</span>
            {i < STEPS.length - 1 && <span className={`mx-xs h-px flex-1 ${i < index ? 'bg-success' : 'bg-outline'}`} />}
          </li>
        ))}
      </ol>
    </div>
  );
}
