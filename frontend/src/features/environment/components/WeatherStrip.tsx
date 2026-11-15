import type { ReactNode } from 'react';
import { Icon } from '@/shared/ui/Icon';
import { TEXT_TONE } from '@/shared/ui/Meter';
import { CHECK_ICON, VERDICT_META, plainWord } from '../lib/verdict';
import type { Readiness } from '../types';

interface WeatherStripProps {
  readiness: Readiness | null;
  children?: ReactNode; // tarjeta extra a la derecha (p. ej. "Supplies to return")
}

/** Franja inferior: cuatro mediciones en palabras simples y una cara por estado. */
export function WeatherStrip({ readiness, children }: WeatherStripProps) {
  return (
    <footer className="grid grid-cols-5 gap-md px-md pb-sm">
      {(readiness?.checks ?? []).map((check) => (
        <div
          key={check.key}
          title={`${check.label}: ${check.value} ${check.unit} · ${check.source}`}
          className="flex min-w-0 items-center justify-between gap-xs rounded-lg border border-outline bg-surface-container px-md py-xs"
        >
          <div className="flex min-w-0 items-center gap-sm">
            <Icon name={CHECK_ICON[check.key]} className="shrink-0 text-[24px] text-accent" />
            <div className="min-w-0">
              <span className="block font-headline text-title-md leading-tight text-on-surface">{plainWord(check)}</span>
              <span translate="no" className="font-mono text-mono-sm text-on-surface-variant">
                {check.value} {check.unit}
              </span>
            </div>
          </div>
          <Icon name={VERDICT_META[check.verdict].face} className={`text-[24px] ${TEXT_TONE[VERDICT_META[check.verdict].tone]}`} />
        </div>
      ))}
      {!readiness &&
        Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-[52px] animate-pulse rounded-lg border border-outline bg-surface-container" />
        ))}
      {children}
    </footer>
  );
}
