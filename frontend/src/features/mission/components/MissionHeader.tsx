import { useState, type ReactNode } from 'react';
import { Icon } from '@/shared/ui/Icon';
import { useMission } from '../state/MissionContext';
import { CrewSuitModal } from './CrewSuitModal';
import { GaleConceptModal } from './GaleConceptModal';
import { NasaLabsModal } from './NasaLabsModal';
import sendaLogo from '@/shared/assets/senda-logo.png';

export function SendaLogo() {
  return (
    <div className="flex items-center gap-sm">
      <img src={sendaLogo} alt="SENDA" className="h-20 w-20 rounded-full" />
    </div>
  );
}

/** Top bar with mission title, NASA Labs, Gale EZ & SEV reference, and navigation back to Mars globe. */
/** extra: controles que añade la página (p. ej. quién planifica), sin acoplar features. */
export function MissionHeader({ extra }: { extra?: ReactNode } = {}) {
  const { state, dispatch, targets } = useMission();
  const [conceptOpen, setConceptOpen] = useState(false);
  const [labsOpen, setLabsOpen] = useState(false);
  const [crewOpen, setCrewOpen] = useState(false);

  const handleQuickDemo = () => {
    const demoIds = targets
      .filter((t) => !t.is_base)
      .slice(0, 3)
      .map((t) => t.id);
    if (demoIds.length > 0) {
      dispatch({ type: 'loadDemo', goals: demoIds });
    }
  };

  return (
    <header className="flex flex-col border-b border-outline-variant bg-surface-container">
      <div className="flex flex-wrap items-center justify-between gap-sm px-xl py-sm">
        <SendaLogo />
        <div className="flex flex-col">
          <h1 className="font-headline text-headline-lg tracking-wide text-on-surface">Mount Sharp Exploration</h1>
          <span className="font-mono text-[10px] text-on-surface-variant">
            MSL REMS: 845 Pa · Dust τ={state.env.tau.toFixed(2)} · RAD {state.env.speActive ? '1.85' : '0.65'} mSv/sol · Gale EZ 100 km
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-sm">
          <button
            type="button"
            onClick={handleQuickDemo}
            title="Auto-load 3 Gale Crater science targets for instant presentation demo"
            className="inline-flex items-center gap-xs rounded-full border border-success/50 bg-success/15 px-md py-xs font-mono text-mono-sm font-bold text-success transition-colors duration-fast hover:bg-success/25"
          >
            <Icon name="play_arrow" className="text-[16px]" />
            <span>Quick Demo</span>
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: 'resetMission' })}
            title="Reset goals, routes, and environment for a fresh mission"
            className="inline-flex items-center gap-xs rounded-full border border-outline bg-surface px-md py-xs font-mono text-mono-sm text-on-surface-variant transition-colors duration-fast hover:border-error hover:text-error"
          >
            <Icon name="restart_alt" className="text-[16px]" />
            <span>Reset</span>
          </button>
          {state.phase === 'go' && (
            <button
              type="button"
              onClick={() => dispatch({ type: 'setPhase', phase: 'plan' })}
              className="inline-flex items-center gap-xs rounded-full border border-accent bg-surface px-md py-xs font-mono text-mono-sm text-accent transition-colors duration-fast hover:bg-primary hover:text-on-primary"
            >
              <Icon name="edit_road" className="text-[16px]" />
              <span>Replan</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setCrewOpen(true)}
            title="Configure Astronaut Names, Team Callsign & Suit Health Telemetry"
            className="inline-flex items-center gap-xs rounded-full border border-outline bg-surface px-md py-xs font-mono text-mono-sm text-on-surface transition-colors duration-fast hover:border-accent hover:text-accent"
          >
            <Icon name="badge" className="text-[16px] text-warning" />
            <span>{state.crew.teamName}</span>
          </button>
          <button
            type="button"
            onClick={() => setLabsOpen(true)}
            title="Open xEMU Monte Carlo, RIMFAX GPR, SHERLOC Raman, MSR Rack & CAPCOM"
            className="inline-flex items-center gap-xs rounded-full border border-outline bg-surface px-md py-xs font-mono text-mono-sm text-on-surface transition-colors duration-fast hover:border-accent hover:text-accent"
          >
            <Icon name="science" className="text-[16px] text-success" />
            <span>NASA Labs</span>
          </button>
          <button
            type="button"
            onClick={() => setConceptOpen(true)}
            title="View Gale Crater Exploration Zone & Pressurized SEV Architecture"
            className="inline-flex items-center gap-xs rounded-full border border-outline bg-surface px-md py-xs font-mono text-mono-sm text-on-surface transition-colors duration-fast hover:border-accent hover:text-accent"
          >
            <Icon name="satellite_alt" className="text-[16px] text-accent" />
            <span>Gale EZ &amp; SEV</span>
          </button>
          {extra}
          <button
            type="button"
            onClick={() => dispatch({ type: 'backToGlobe' })}
            className="inline-flex items-center gap-sm rounded-full border-2 border-outline bg-surface-container-high px-lg py-xs font-headline text-title-md text-on-surface transition-colors duration-fast hover:border-accent hover:text-accent"
          >
            <Icon name="arrow_back" className="text-[20px] text-accent" />
            <span>View Mars</span>
          </button>
        </div>
      </div>
      <CrewSuitModal open={crewOpen} onClose={() => setCrewOpen(false)} />
      <GaleConceptModal open={conceptOpen} onClose={() => setConceptOpen(false)} />
      <NasaLabsModal open={labsOpen} onClose={() => setLabsOpen(false)} />
    </header>
  );
}
