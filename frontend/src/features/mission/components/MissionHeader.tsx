import { useState } from 'react';
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
  /** Bloqueado: se ve con candado y "Soon" (datos todavía sin fuente oficial). */
  locked?: boolean;
  tone?: 'default' | 'accent' | 'success';
}

function HeaderButton({ icon, label, onClick, locked, tone = 'default' }: HeaderButtonProps) {
  const toneCls = {
    default: 'border-outline text-on-surface hover:border-accent hover:text-accent',
    accent: 'border-accent text-accent hover:bg-primary hover:text-on-primary',
    success: 'border-success/50 bg-success/15 text-success hover:bg-success/25',
  }[tone];
  return (
    <button
      type="button"
      disabled={locked}
      onClick={onClick}
      title={locked ? `${label} · soon` : label}
      className={`inline-flex min-h-[44px] items-center gap-xs rounded-full border bg-surface px-md font-mono text-mono-sm transition-colors duration-fast disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-outline disabled:hover:text-on-surface ${toneCls}`}
    >
      <Icon name={locked ? 'lock' : icon} className="text-[18px]" />
      <span>{label}</span>
      {locked && <span className="font-label text-label-sm uppercase text-on-surface-variant">Soon</span>}
    </button>
  );
}

/** Barra superior: misión, clima real, tripulación y acciones (texto mínimo: icono + 1–2 palabras). */
export function MissionHeader() {
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
      <div className="flex flex-wrap items-center justify-between gap-sm px-xl py-sm">
        <SendaLogo />
        <div className="flex flex-col gap-xs">
          <h1 className="font-headline text-headline-lg tracking-wide text-on-surface">Mount Sharp</h1>
          {readiness && <ReadinessBadge readiness={readiness} />}
        </div>
        <div className="flex flex-wrap items-center gap-sm">
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
            </>
          )}
          <HeaderButton icon="science" label="Labs" locked />
          <HeaderButton icon="memory" label="Quantum" locked />
          <HeaderButton icon="satellite_alt" label="Gale EZ" onClick={() => setConceptOpen(true)} />
          <HeaderButton icon="public" label="Mars" onClick={() => dispatch({ type: 'backToGlobe' })} />
        </div>
      </div>
      <CrewSuitModal open={crewOpen} onClose={() => setCrewOpen(false)} />
      <GaleConceptModal open={conceptOpen} onClose={() => setConceptOpen(false)} />
    </header>
  );
}
