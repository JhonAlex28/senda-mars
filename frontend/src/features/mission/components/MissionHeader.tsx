import { Icon } from '@/shared/ui/Icon';
import { allEvasPlanned } from '../state/selectors';
import { useMission } from '../state/MissionContext';
import type { Phase } from '../state/types';

interface Tab {
  phase: Exclude<Phase, 'globe'>;
  label: string;
  icon: string;
  enabled: boolean;
  hint: string;
}

export function SendaLogo() {
  return (
    <div className="flex items-center gap-sm">
      <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-accent bg-primary">
        <span className="font-headline text-title-md font-bold text-on-primary">S</span>
      </div>
      <span translate="no" className="font-headline text-headline-sm uppercase tracking-wider text-on-surface">SENDA</span>
    </div>
  );
}

/** Barra superior con las tres grandes pestañas del flujo: Rover route → Spacewalks → Simulation. */
export function MissionHeader() {
  const { state, dispatch } = useMission();
  const inGo = state.phase === 'go';
  const tabs: Tab[] = [
    { phase: 'plan', label: 'Rover route', icon: 'route', enabled: !inGo, hint: 'Choose goals and the rover route' },
    { phase: 'walk', label: 'Spacewalks', icon: 'directions_walk', enabled: !inGo && !!state.traverse, hint: 'Plan the rover route first' },
    { phase: 'go', label: 'Simulation', icon: 'rocket_launch', enabled: inGo || allEvasPlanned(state), hint: 'Plan every spacewalk first' },
  ];

  return (
    <header className="flex flex-col border-b border-outline-variant bg-surface-container">
      <div className="flex items-center justify-between px-xl py-sm">
        <SendaLogo />
        <h1 className="font-headline text-headline-lg tracking-wide text-on-surface">Mount Sharp Exploration</h1>
        <button
          type="button"
          onClick={() => dispatch({ type: 'backToGlobe' })}
          className="inline-flex items-center gap-sm rounded-full border-2 border-outline bg-surface-container-high px-lg py-xs font-headline text-title-md text-on-surface transition-colors duration-fast hover:border-accent hover:text-accent"
        >
          <Icon name="arrow_back" className="text-[20px] text-accent" />
          <span>View Mars</span>
        </button>
      </div>

      <nav className="flex items-center justify-center gap-md px-xl pb-sm" aria-label="Mission modes">
        {tabs.map((tab, i) => {
          const active = state.phase === tab.phase;
          return (
            <button
              key={tab.phase}
              type="button"
              disabled={!tab.enabled}
              title={tab.enabled ? undefined : tab.hint}
              aria-current={active ? 'step' : undefined}
              onClick={() => dispatch({ type: 'setPhase', phase: tab.phase })}
              className={`inline-flex items-center gap-sm rounded-full px-xl py-xs font-headline text-title-md transition-colors duration-fast disabled:cursor-not-allowed disabled:opacity-40 ${
                active
                  ? 'bg-primary text-on-primary'
                  : 'border border-outline bg-surface text-on-surface-variant enabled:hover:border-accent enabled:hover:text-on-surface'
              }`}
            >
              <span className="font-mono text-mono-sm opacity-70">{i + 1}</span>
              <Icon name={tab.icon} className="text-[20px]" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </header>
  );
}
