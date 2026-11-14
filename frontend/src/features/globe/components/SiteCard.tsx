import type { Readiness } from '@/features/environment';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';

interface SiteCardProps {
  readiness: Readiness | null;
  goalCount: number;
  onExplore: () => void;
}

/** Tarjeta flotante con datos del sitio y el botón para abrir la misión. */
export function SiteCard({ readiness, goalCount, onExplore }: SiteCardProps) {
  const check = (key: string) => readiness?.checks.find((c) => c.key === key);
  const temp = check('temperature');
  const dust = check('dust');

  return (
    <article className="flex w-80 flex-col gap-md rounded-lg border border-outline bg-surface-container/95 p-lg shadow-2xl">
      <header className="flex items-start justify-between gap-sm border-b border-outline-variant pb-md">
        <div>
          <h2 className="font-headline text-headline-sm uppercase text-on-surface">Mount Sharp Exploration</h2>
          <p className="font-body text-body-sm text-on-surface-variant">Mount Sharp · Gale Crater</p>
          <p className="mt-xs font-mono text-mono-sm tabular-nums text-on-surface-variant">4.79°S 137.39°E</p>
        </div>
        <span role="status" className="inline-flex shrink-0 items-center gap-xs rounded-full border border-outline bg-surface-container-high px-sm py-xs font-label text-label-sm uppercase text-accent">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          Live data
        </span>
      </header>

      <div className="grid grid-cols-2 gap-md">
        <div className="rounded-md border border-outline-variant bg-surface-container-high/60 p-sm">
          <span className="block font-label text-label-sm uppercase text-on-surface-variant">EVA window temp</span>
          <span className="mt-xs block font-mono text-mono-md tabular-nums text-on-surface">{temp ? `${temp.value}°C` : '—'}</span>
        </div>
        <div className="rounded-md border border-outline-variant bg-surface-container-high/60 p-sm">
          <span className="block font-label text-label-sm uppercase text-on-surface-variant">Dust</span>
          <span className="mt-xs block font-mono text-mono-md tabular-nums text-accent">{dust ? `${dust.value} τ` : '—'}</span>
        </div>
      </div>

      <div className="flex items-center justify-between font-body text-body-sm text-on-surface-variant">
        <span className="flex items-center gap-xs">
          <Icon name="diamond" className="text-[16px] text-accent" /> {goalCount} science targets
        </span>
        <span className="font-mono text-mono-sm text-primary">{readiness ? `SOL ${readiness.sol}` : '…'}</span>
      </div>

      <Button icon="arrow_forward" onClick={onExplore} className="w-full">
        Explore base
      </Button>
    </article>
  );
}
