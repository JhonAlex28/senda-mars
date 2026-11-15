import { Icon } from '@/shared/ui/Icon';
import { VERDICT_META } from '../lib/verdict';
import type { Readiness, Verdict } from '../types';

const PILL: Record<Verdict, string> = {
  go: 'bg-success text-on-success',
  caution: 'bg-warning text-on-warning',
  no_go: 'bg-error text-on-error',
};

/** Veredicto del clima en una fila: icono + GO / CAUTION / NO GO. Sol y fuente quedan en el tooltip. */
export function ReadinessBadge({ readiness }: { readiness: Readiness }) {
  const meta = VERDICT_META[readiness.verdict];
  const sources = [...new Set(readiness.checks.map((c) => c.source.split(' ')[0]))].join(', ');
  return (
    <div className="flex items-center justify-between gap-sm" title={`Sol ${readiness.sol}, ${readiness.local_solar_time} LTST · ${sources}`}>
      <span className="flex items-center gap-xs font-body text-body-sm text-on-surface-variant">
        <Icon name="partly_cloudy_day" className="text-[18px] text-accent" />
        Weather
      </span>
      <span translate="no" className={`inline-flex items-center gap-xs rounded-full px-sm py-[2px] font-headline text-label-lg uppercase ${PILL[readiness.verdict]}`}>
        <Icon name={meta.face} className="text-[18px]" />
        {meta.label}
      </span>
    </div>
  );
}
