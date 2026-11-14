import { Icon } from '@/shared/ui/Icon';
import { planStep } from '../state/selectors';
import { useMission } from '../state/MissionContext';
import type { PlanStep } from '../state/types';

const STEPS: { step: PlanStep; label: string; icon: string; text: string }[] = [
  { step: 'base', label: 'Base', icon: 'home_pin', text: 'Where is our base? Tap the map or type the coordinates, then confirm.' },
  { step: 'goals', label: 'Goals', icon: 'diamond', text: 'Tap a rock on the map to see what we can learn there. Add the ones you like.' },
  { step: 'traverse', label: 'Rover', icon: 'route', text: 'Sort your goals (best first) and press PLAN TRAVERSE.' },
  { step: 'eva', label: 'Walks', icon: 'directions_walk', text: 'Pick a parking spot (P) and press PLAN EVA ROUTE. Do it for every spot.' },
  { step: 'ready', label: 'Trip', icon: 'rocket_launch', text: 'All set! Check the weather and press START TRIP.' },
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
      <p key={current} className="animate-fade-up font-body text-body-sm text-on-surface">
        {STEPS[index].text}
      </p>
    </div>
  );
}
