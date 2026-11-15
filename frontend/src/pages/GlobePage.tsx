import { useState } from 'react';
import { useReadiness } from '@/features/environment';
import { InteractiveGlobe, SITES, SiteCard } from '@/features/globe';
import { SendaLogo, useMission } from '@/features/mission';
import { Icon } from '@/shared/ui/Icon';

/** Pantalla de inicio: Marte en 3D con los sitios de exploración. */
export function GlobePage() {
  const { dispatch, targets } = useMission();
  const { data: readiness } = useReadiness();
  const [selectedId, setSelectedId] = useState(() => SITES.find((s) => s.active)?.id ?? SITES[0].id);
  const site = SITES.find((s) => s.id === selectedId) ?? SITES[0];

  return (
    <div className="starfield flex min-h-full flex-col overflow-x-hidden">
      <header className="relative z-20 flex items-center justify-between border-b border-outline-variant bg-surface/85 px-xl py-md">
        <SendaLogo />
        <p className="hidden font-body text-body-sm text-on-surface-variant md:block">Safe paths to Martian science</p>
        <div className="flex items-center gap-sm rounded-full border border-outline bg-surface-container px-md py-xs">
          <span className="h-2 w-2 rounded-full bg-primary" />
          <span className="font-label text-label-sm uppercase text-on-surface-variant">
            Current planet: <strong className="text-on-surface">Mars</strong>
          </span>
        </div>
      </header>

      <main className="relative flex flex-1 items-center justify-center gap-2xl px-xl py-lg max-lg:flex-col">
        <div className="flex flex-col items-center gap-sm">
          <div className="relative">
            <InteractiveGlobe sites={SITES} selectedId={selectedId} onSelect={setSelectedId} />
          </div>
          <p className="flex items-center gap-xs font-label text-label-sm uppercase tracking-widest text-on-surface-variant">
            <Icon name="drag_pan" className="text-[16px] text-accent" /> Drag to turn · Scroll to zoom
          </p>
        </div>

        <div className="flex flex-col gap-md">
          <SiteCard
            site={site}
            readiness={readiness}
            goalCount={targets.filter((t) => !t.is_base).length}
            onExplore={() => dispatch({ type: 'openMission', missionId: site.id })}
          />
          <nav aria-label="Sites" className="flex w-80 flex-col gap-xs">
            {SITES.map((s) => {
              const on = s.id === selectedId;
              return (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setSelectedId(s.id)}
                  className={`flex items-center gap-sm rounded-md border px-sm py-xs text-left font-body text-body-sm transition-colors duration-fast ${
                    on ? 'border-accent bg-surface-container text-on-surface' : 'border-outline-variant bg-surface/60 text-on-surface-variant hover:border-accent hover:text-on-surface'
                  }`}
                >
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${s.active ? 'bg-primary' : 'border border-on-surface-variant'}`} />
                  <span className="min-w-0 flex-1 truncate">{s.name}</span>
                  <span className={`shrink-0 font-label text-label-sm uppercase ${s.active ? 'text-accent' : 'text-on-surface-variant'}`}>
                    {s.active ? 'Open' : 'Soon'}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>
      </main>
    </div>
  );
}
