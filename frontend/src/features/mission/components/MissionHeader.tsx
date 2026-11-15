import { useState, type ReactNode } from 'react';
import { ReadinessBadge, useReadiness } from '@/features/environment';
import { Icon } from '@/shared/ui/Icon';
import { useMission } from '../state/MissionContext';
import { CrewSuitModal } from './CrewSuitModal';
import { GaleConceptModal } from './GaleConceptModal';
import sendaLogo from '@/shared/assets/senda-logo.png';

export function SendaLogo() {
  return (
    <div className="flex items-center gap-sm">
      <img src={sendaLogo} alt="SENDA" className="h-20 w-20 rounded-full" />
    </div>
  );
}

interface HeaderButtonProps {
  icon: string;
  label: string;
  onClick?: () => void;
  tone?: 'default' | 'accent' | 'success';
}

function HeaderButton({ icon, label, onClick, tone = 'default' }: HeaderButtonProps) {
  const toneCls = {
    default: 'border-outline text-on-surface hover:border-accent hover:text-accent',
    accent: 'border-accent text-accent hover:bg-primary hover:text-on-primary',
    success: 'border-success/50 bg-success/15 text-success hover:bg-success/25',
  }[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={`inline-flex min-h-[44px] items-center gap-xs rounded-full border bg-surface px-md font-mono text-mono-sm transition-colors duration-fast ${toneCls}`}
    >
      <Icon name={icon} className="text-[18px]" />
      <span>{label}</span>
    </button>
  );
}

/** Barra superior: misión, clima real, tripulación y acciones (texto mínimo: icono + 1–2 palabras). */
/** extra: controles que añade la página (p. ej. quién planifica), sin acoplar features. */
export function MissionHeader({ extra }: { extra?: ReactNode } = {}) {
  const { state, dispatch, targets } = useMission();
  const { data: readiness } = useReadiness();
  const [conceptOpen, setConceptOpen] = useState(false);
  const [crewOpen, setCrewOpen] = useState(false);
  const going = state.phase === 'go';

  const loadDemo = () => {
    const ids = targets.filter((t) => !t.is_base).slice(0, 3).map((t) => t.id);
    if (ids.length > 0) dispatch({ type: 'loadDemo', goals: ids });
  };

  return (
    <header className="flex flex-col border-b border-outline-variant bg-surface-container">
      <div className="flex flex-wrap items-center gap-sm px-xl py-sm">
        {/* Izquierda: logo, volver al globo, misión y clima real */}
        <SendaLogo />
        <button
          type="button"
          onClick={() => dispatch({ type: 'backToGlobe' })}
          aria-label="Return to Mars globe"
          title="Return to Mars"
          className="inline-flex min-h-[44px] items-center gap-xs rounded-full border-2 border-accent/60 bg-surface-container-high pl-xs pr-md font-headline text-title-md text-on-surface transition-colors duration-fast hover:border-accent hover:bg-primary hover:text-on-primary"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/15">
            <Icon name="arrow_back" className="text-[20px] text-accent" />
          </span>
          Return
        </button>
        <h1 className="ml-sm font-headline text-headline-lg tracking-wide text-on-surface">Mount Sharp Exploration</h1>
        {readiness && <ReadinessBadge readiness={readiness} stacked />}

        {/* Derecha: acciones; quien planifica (extra) queda al final */}
        <div className="ml-auto flex flex-wrap items-center gap-sm">
          {going ? (
            <>
              <HeaderButton icon="monitor_heart" label="Crew status" tone="accent" onClick={() => dispatch({ type: 'setCrewStatusOpen', open: true })} />
              <HeaderButton icon="edit_road" label="Replan" onClick={() => dispatch({ type: 'setPhase', phase: 'plan' })} />
            </>
          ) : (
            <>
              <HeaderButton icon="play_arrow" label="Demo" tone="success" onClick={loadDemo} />
              <HeaderButton icon="restart_alt" label="Reset" onClick={() => dispatch({ type: 'resetMission' })} />
              <HeaderButton icon="badge" label="Crew config" onClick={() => setCrewOpen(true)} />
              <HeaderButton icon="auto_awesome" label="Copilot" tone="accent" onClick={() => dispatch({ type: 'setCopilotOpen', open: true })} />
            </>
          )}
          <HeaderButton icon="satellite_alt" label="Gale EZ" onClick={() => setConceptOpen(true)} />
          {extra}
        </div>
      </div>
      <CrewSuitModal open={crewOpen} onClose={() => setCrewOpen(false)} />
      <GaleConceptModal open={conceptOpen} onClose={() => setConceptOpen(false)} />
    </header>
  );
}
