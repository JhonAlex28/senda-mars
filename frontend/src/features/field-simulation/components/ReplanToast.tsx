import { useEffect } from 'react';
import { formatDelta } from '@/shared/lib/format';
import { Icon } from '@/shared/ui/Icon';
import { Live } from '@/shared/ui/Text';
import type { ReplanResult } from '../hooks/useSimulation';

const VISIBLE_MS = 8000;

/** Diferencia con un decimal ("+0.7 min"), para que los desvíos cortos no aparezcan como cero. */
function preciseDelta(value: number, unit: string): string {
  const rounded = Math.round(value * 10) / 10;
  if (rounded === 0) return `±0 ${unit}`;
  return `${rounded > 0 ? '+' : '−'}${Math.abs(rounded)} ${unit}`;
}

/** Aviso tras recalcular: cuánto cambian distancia, tiempo y recurso del tramo. */
export function ReplanToast({ result, onClose }: { result: ReplanResult; onClose: () => void }) {
  useEffect(() => {
    const id = window.setTimeout(onClose, VISIBLE_MS);
    return () => window.clearTimeout(id);
  }, [result, onClose]);

  const resource = result.mode === 'rover' ? '🔋' : 'O₂';
  return (
    <div
      role="status"
      className="fixed left-1/2 top-[112px] z-40 flex w-max max-w-[min(560px,calc(100%-2rem))] -translate-x-1/2 animate-fade-up items-center gap-sm rounded-lg border border-warning/60 bg-surface-container px-md py-sm shadow-2xl"
    >
      <Icon name="alt_route" className="text-[22px] text-warning" />
      <div className="min-w-0">
        <p className="font-headline text-title-md">{result.title}. We found a new route.</p>
        <p className="flex flex-wrap gap-x-sm font-body text-body-sm text-on-surface-variant">
          <span>
            Distance: <Live className="font-mono text-mono-sm text-on-surface">{formatDelta(result.distanceDelta, ' m')}</Live>
          </span>
          <span>
            Time: <Live className="font-mono text-mono-sm text-on-surface">{preciseDelta(result.minutesDelta, 'min')}</Live>
          </span>
          <span>
            {resource}: <Live className="font-mono text-mono-sm text-on-surface">{preciseDelta(-result.resourceDelta, '%')}</Live>
          </span>
        </p>
      </div>
      <button type="button" onClick={onClose} aria-label="Dismiss" className="text-on-surface-variant hover:text-on-surface">
        <Icon name="close" className="text-[16px]" />
      </button>
    </div>
  );
}
