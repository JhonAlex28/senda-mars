import { Icon } from '@/shared/ui/Icon';
import { allEvasPlanned, planReserve, planStep } from '../state/selectors';
import { useMission } from '../state/MissionContext';
import type { PlanStep } from '../state/types';

const STEPS: { step: PlanStep; label: string; icon: string }[] = [
  { step: 'goals', label: 'Goals', icon: 'diamond' },
  { step: 'traverse', label: 'Vehicle', icon: 'airport_shuttle' },
  { step: 'eva', label: 'EVA', icon: 'directions_walk' },
  { step: 'ready', label: 'Start', icon: 'rocket_launch' },
];

/** Pasos sobre el mapa: Goals → Vehicle → EVA → Start. */
export function StepBanner() {
  const { state, dispatch } = useMission();
  const current = planStep(state);
  const index = STEPS.findIndex((s) => s.step === current);
  const canWalk = !!state.traverse;
  // Salir lo deciden el motor (retorno con reserva) y el clima real (LaunchCard)
  const canGo = allEvasPlanned(state) && !!planReserve(state)?.returnOk;

  const onStepClick = (step: PlanStep) => {
    if (step === 'goals' || step === 'traverse') dispatch({ type: 'setPhase', phase: 'plan' });
    else if (step === 'eva' && canWalk) dispatch({ type: 'setPhase', phase: 'walk' });
    else if (step === 'ready' && canGo) dispatch({ type: 'setPhase', phase: 'go' });
  };

  return (
    <div className="pointer-events-auto absolute left-md top-md z-30 flex w-[min(460px,calc(100%-5.5rem))] flex-col gap-xs rounded-lg border border-accent/50 bg-surface-container/95 px-md py-xs shadow-xl backdrop-blur">
      <ol className="flex items-center justify-between gap-xs" aria-label="Planning steps">
        {STEPS.map((s, i) => {
          const clickable =
            s.step === 'goals' ||
            s.step === 'traverse' ||
            (s.step === 'eva' && canWalk) ||
            (s.step === 'ready' && canGo);
          return (
            <li key={s.step} className="flex flex-1 items-center gap-xs last:flex-none">
              <button
                type="button"
                disabled={!clickable}
                onClick={() => onStepClick(s.step)}
                className="flex items-center gap-xs rounded px-1 py-0.5 text-left transition hover:bg-surface-container-high disabled:cursor-default disabled:hover:bg-transparent"
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[14px] ${
                    i < index ? 'bg-success text-on-success' : i === index ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface-variant'
                  }`}
                  aria-current={i === index ? 'step' : undefined}
                >
                  <Icon name={i < index ? 'check' : s.icon} className="text-[14px]" />
                </span>
                <span className={`hidden truncate font-label text-label-sm uppercase sm:inline ${i === index ? 'text-on-surface' : 'text-on-surface-variant'}`}>{s.label}</span>
              </button>
              {i < STEPS.length - 1 && <span className={`mx-xs h-px flex-1 ${i < index ? 'bg-success' : 'bg-outline'}`} />}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
