import type { Readiness } from '@/features/environment';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { formatLatLon, type Site } from '../sites';

interface SiteCardProps {
  site: Site;
  readiness: Readiness | null;
  goalCount: number;
  onExplore: () => void;
}

/** Tarjeta flotante con datos del sitio y el botón para abrir la misión. */
export function SiteCard({ site, readiness, goalCount, onExplore }: SiteCardProps) {
  if (!site.active) return <ComingSoonCard site={site} />;
  const check = (key: string) => readiness?.checks.find((c) => c.key === key);
  const temp = check('temperature');
  const dust = check('dust');

  return (
    <article key={site.id} className="flex w-80 animate-fade-up flex-col gap-md rounded-lg border border-outline bg-surface-container/95 p-lg shadow-2xl">
      <header className="flex items-start justify-between gap-sm border-b border-outline-variant pb-md">
        <div>
          <h2 className="font-headline text-headline-sm uppercase text-on-surface">{site.name} Exploration</h2>
          <p className="font-body text-body-sm text-on-surface-variant">{site.region} · {site.mission}</p>
          <p className="mt-xs font-mono text-mono-sm tabular-nums text-on-surface-variant" translate="no">
            {formatLatLon(site)}
          </p>
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

/** Sitio que todavía no tiene misión preparada: solo dónde está y quién lo estudió. */
function ComingSoonCard({ site }: { site: Site }) {
  return (
    <article key={site.id} className="flex w-80 animate-fade-up flex-col gap-md rounded-lg border border-outline bg-surface-container/95 p-lg shadow-2xl">
      <header className="flex items-start justify-between gap-sm">
        <div>
          <h2 className="font-headline text-headline-sm uppercase text-on-surface">{site.name}</h2>
          <p className="font-body text-body-sm text-on-surface-variant">{site.region}</p>
          <p translate="no" className="mt-xs font-mono text-mono-sm tabular-nums text-on-surface-variant">
            {formatLatLon(site)}
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-outline px-sm py-xs font-label text-label-sm uppercase text-on-surface-variant">Soon</span>
      </header>
      <p className="flex items-center gap-xs font-body text-body-sm text-on-surface-variant">
        <Icon name="smart_toy" className="text-[18px] text-accent" />
        <span>
          Explored by <strong className="text-on-surface">{site.mission}</strong>
        </span>
      </p>
      <Button icon="lock" disabled className="w-full">
        Coming soon
      </Button>
    </article>
  );
}
