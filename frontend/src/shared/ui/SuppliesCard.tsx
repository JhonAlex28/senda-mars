import { Meter, TEXT_TONE, toneForRemaining } from './Meter';
import { Live } from './Text';

interface SuppliesCardProps {
  pct: number | null; // null = todavía no hay ruta elegida
  hint: string;
}

/** Tarjeta de la franja inferior: cuánta batería queda para volver. */
export function SuppliesCard({ pct, hint }: SuppliesCardProps) {
  const tone = toneForRemaining(pct ?? 100);
  return (
    <div className="flex min-w-0 flex-col justify-center gap-1 rounded-lg border border-outline bg-surface-container px-md py-xs" title={hint}>
      <div className="flex items-center justify-between gap-sm font-label text-label-sm text-on-surface-variant">
        <span className="min-w-0 truncate">Battery to come back</span>
        <Live className={`shrink-0 font-mono ${TEXT_TONE[tone]}`}>{pct === null ? '—' : `${Math.round(pct)}%`}</Live>
      </div>
      <Meter value={pct ?? 0} tone={tone} label="Battery to come back" className="h-2" />
    </div>
  );
}
