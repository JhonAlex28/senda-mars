import { formatDistance, formatMinutes } from '@/shared/lib/format';
import { Icon } from '@/shared/ui/Icon';
import { Meter, TEXT_TONE } from '@/shared/ui/Meter';
import { Live, Phrase } from '@/shared/ui/Text';
import { PROFILE_META, SAFETY_FACE, safetyTone } from '../lib/profiles';
import type { RoutePlan } from '../types';

interface RouteOptionCardProps {
  route: RoutePlan;
  selected: boolean;
  onSelect: () => void;
}

const SELECTED_BORDER = { success: 'border-success', warning: 'border-warning', error: 'border-error' } as const;

/** Una alternativa de ruta: seguridad, tiempo, distancia, pendiente, obstáculos y recurso restante. */
export function RouteOptionCard({ route, selected, onSelect }: RouteOptionCardProps) {
  const meta = PROFILE_META[route.profile];
  const tone = safetyTone(route.safety_pct);
  const resourceIcon = route.resource.name === 'battery' ? '🔋' : 'O₂';

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`flex w-full flex-col gap-xs rounded-lg bg-surface p-sm text-left transition-colors duration-fast ${
        selected ? `border-2 ${SELECTED_BORDER[tone]}` : 'border border-outline hover:border-accent'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-sm">
        <span className="flex items-center gap-xs font-headline text-title-md text-on-surface">
          <span className={`h-1.5 w-4 shrink-0 rounded-full ${meta.swatch}`} /> {meta.label}
          {selected && <Icon name="check_circle" filled className="text-[16px] text-accent" />}
        </span>
        <span className={`inline-flex items-center gap-xs text-body-sm font-bold ${TEXT_TONE[tone]}`}>
          <Icon name={SAFETY_FACE[tone]} className="text-[16px]" />
          <Phrase>{`${route.safety_pct}% safe`}</Phrase>
        </span>
      </div>
      <Meter value={route.safety_pct} tone={tone} label={`${meta.label} safety`} />
      {/* Cifras: no se traducen; el significado de cada una va en su tooltip */}
      <Live className="flex flex-wrap items-center justify-between gap-x-sm font-mono text-mono-sm tabular-nums text-on-surface-variant">
        <span title="Time">🕒 {formatMinutes(route.duration_min)}</span>
        <span title="Distance">📏 {formatDistance(route.distance_m)}</span>
        <span title="Steepest slope">⛰️ {Math.round(route.max_slope_deg)}°</span>
        <span title="Rough spots on the way">🪨 {route.obstacles}</span>
        <span title={`${route.resource.name} left at the end`}>
          {resourceIcon} {Math.round(route.resource.remaining_pct)}%
        </span>
      </Live>
      {selected && <p className="font-body text-body-sm text-on-surface-variant">{meta.hint}</p>}
      {!route.return_ok && (
        <p className="flex items-center gap-xs font-body text-body-sm text-error">
          <Icon name="warning" className="shrink-0 text-[16px]" /> There is not enough left to come back safely.
        </p>
      )}
    </button>
  );
}
