import { useState, type ReactNode } from 'react';
import { ReadinessBadge, useReadiness } from '@/features/environment';
import { Icon } from '@/shared/ui/Icon';
import { useMission } from '../state/MissionContext';
import { CrewSuitModal } from './CrewSuitModal';
import { GaleConceptModal } from './GaleConceptModal';
import sendaLogo from '@/shared/assets/senda-logo.png';

export function SendaLogo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex shrink-0 items-center gap-sm">
      <img src={sendaLogo} alt="SENDA" className={compact ? 'h-11 w-11 rounded-full' : 'h-20 w-20 rounded-full'} />
    </div>
  );
}

interface HeaderButtonProps {
  icon: string;
  label: string;
  onClick?: () => void;
  tone?: 'default' | 'accent' | 'success';
}

/**
 * Botón de cabecera con el mismo sistema que `shared/ui/Button` (rounded-lg, Space Grotesk en
 * mayúsculas, variantes ghost / secondary / success), a 44 px de alto para la tableta.
 * Por debajo de 2xl muestra solo el icono; el nombre queda en title y aria-label.
 */
const HEADER_BTN =
  'inline-flex h-11 min-w-[44px] shrink-0 items-center justify-center gap-xs rounded-lg px-sm font-headline text-title-md uppercase leading-tight transition-colors duration-fast 2xl:px-md';

const HEADER_TONE: Record<NonNullable<HeaderButtonProps['tone']>, string> = {
  default: 'border border-outline bg-surface text-on-surface hover:border-accent hover:text-accent',
  accent: 'border border-accent bg-surface-container-high text-accent hover:bg-accent/10',
  success: 'border border-success/60 bg-success/10 text-success hover:bg-success/20',
};

function HeaderButton({ icon, label, onClick, tone = 'default', alwaysLabel = false }: HeaderButtonProps & { alwaysLabel?: boolean }) {
  return (
    <button type="button" onClick={onClick} title={label} aria-label={label} className={`${HEADER_BTN} ${HEADER_TONE[tone]}`}>
      <Icon name={icon} className="text-[18px]" />
      <span className={alwaysLabel ? 'hidden sm:inline' : 'hidden 2xl:inline'}>{label}</span>
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
    <header className="border-b border-outline-variant bg-surface-container">
      {/* Una fila compacta: izquierda (logo, Return) · centro (título, clima) · derecha (acciones, usuario) */}
      {/* Izquierda: Return · logo + título + clima (alineados a la izquierda) · derecha: acciones y usuario */}
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-md px-md py-sm lg:px-xl lg:py-[12px]">
        <HeaderButton icon="arrow_back" label="Return" alwaysLabel onClick={() => dispatch({ type: 'backToGlobe' })} />

        <div className="flex min-w-0 items-center gap-sm xl:gap-md">
          <SendaLogo compact />
          <h1 className="min-w-0 truncate font-headline text-title-md tracking-wide text-on-surface lg:text-headline-sm 2xl:text-headline-lg">
            Mount Sharp Exploration
          </h1>
          {readiness && (
            <div className="ml-sm hidden shrink-0 border-l border-outline-variant pl-md sm:block xl:ml-md xl:pl-lg">
              <ReadinessBadge readiness={readiness} stacked />
            </div>
          )}
        </div>

        <div className="flex items-center gap-xs xl:gap-sm">
          {going ? (
            <>
              <HeaderButton icon="monitor_heart" label="Crew status" tone="accent" onClick={() => dispatch({ type: 'setCrewStatusOpen', open: true })} />
              <HeaderButton icon="edit_road" label="Replan" onClick={() => dispatch({ type: 'setPhase', phase: 'plan' })} />
            </>
          ) : (
            <>
              <HeaderButton icon="play_arrow" label="Demo" tone="success" onClick={loadDemo} />
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
