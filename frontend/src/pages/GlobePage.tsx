import { useReadiness } from '@/features/environment';
import { MarsGlobe, SiteCard } from '@/features/globe';
import { SendaLogo, useMission } from '@/features/mission';
import { Icon } from '@/shared/ui/Icon';

/** Pantalla de inicio: el planeta y el sitio de la misión. */
export function GlobePage() {
  const { dispatch, targets } = useMission();
  const { data: readiness } = useReadiness();
  const open = () => dispatch({ type: 'openMission' });

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
        <div className="flex flex-col items-center">
          <div className="relative flex h-[540px] w-[540px] items-center justify-center">
            <div className="pointer-events-none absolute inset-[50px] rounded-full shadow-[0_0_90px_18px_rgba(217,83,43,0.22)]" />
            <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 540 540" fill="none" aria-hidden="true">
              <ellipse cx="270" cy="270" rx="255" ry="86" transform="rotate(-18 270 270)" stroke="#F0875A" strokeOpacity="0.25" strokeDasharray="4 4" />
            </svg>
            <MarsGlobe>
              <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 440 440" fill="none" aria-hidden="true">
                <path d="M 120 180 Q 170 150 205 238" stroke="#F0875A" strokeWidth="2" strokeDasharray="5 5" strokeLinecap="round" />
              </svg>
              <button type="button" onClick={open} className="group absolute left-[205px] top-[238px] flex -translate-x-1/2 -translate-y-full flex-col items-center focus:outline-none" aria-label="Open the Mount Sharp mission">
                <span className="mb-xs whitespace-nowrap rounded-md border border-primary bg-surface-container/95 px-sm py-xs font-label text-label-sm uppercase text-on-surface transition-colors group-hover:border-accent">
                  Mount Sharp <span className="text-accent">• Active</span>
                </span>
                <span className="relative flex h-4 w-4">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
                  <span className="relative h-4 w-4 rounded-full border-2 border-on-surface bg-primary shadow-[0_0_14px_#D9532B]" />
                </span>
              </button>
            </MarsGlobe>
          </div>
          <p className="mt-sm flex items-center gap-xs font-label text-label-lg uppercase tracking-widest text-accent">
            <Icon name="touch_app" className="text-[18px]" /> Click on the base to explore
          </p>
        </div>

        <SiteCard readiness={readiness} goalCount={targets.filter((t) => !t.is_base).length} onExplore={open} />
      </main>
    </div>
  );
}
