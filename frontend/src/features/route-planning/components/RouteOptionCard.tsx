import type { ReactNode } from 'react';
import { formatDistance, formatMinutes } from '@/shared/lib/format';
import { Icon } from '@/shared/ui/Icon';
import { Meter, TEXT_TONE, toneForRemaining } from '@/shared/ui/Meter';
import { Live, Phrase } from '@/shared/ui/Text';
import { PROFILE_META, SAFETY_FACE, safetyTone } from '../lib/profiles';
import type { RoutePlan } from '../types';

/** Pendiente de precaución del backend: 10° a pie (EVA), 15° en vehículo. */
const STEEP_DEG = { eva: 10, rover: 15 } as const;

/** Códigos de inviabilidad del motor → etiqueta corta. */
const REASON: Record<string, string> = {
  O2_CAPACITY_EXCEEDED: 'O₂ short',
  PNR_ON_ROUTE: 'No return',
  EVA_WINDOW_EXCEEDED: 'Over EVA time',
  BATTERY_RESERVE: 'Battery reserve',
};

interface Chip {
  icon: string;
  text: string;
  tone: 'warning' | 'error' | 'info';
}

/** Ruta elegida: tres cifras grandes y chips solo cuando hay algo que vigilar. */
export function RouteDetails({ route }: { route: RoutePlan }) {
  const meta = PROFILE_META[route.profile];
  const tone = safetyTone(route.safety_pct);
  const left = route.resource.remaining_pct;
  const battery = route.resource.name === 'battery';
  const reasons = route.infeasible_reasons ?? [];
  const chips: Chip[] = [
    ...(!route.return_ok && reasons.length === 0 ? [{ icon: 'report', text: 'No return', tone: 'error' as const }] : []),
    ...reasons.map((r) => ({ icon: 'report', text: REASON[r] ?? r, tone: 'error' as const })),
    ...(route.max_slope_deg >= STEEP_DEG[route.mode] ? [{ icon: 'trending_up', text: `${Math.round(route.max_slope_deg)}°`, tone: 'warning' as const }] : []),
    ...(route.obstacles > 0 ? [{ icon: 'warning', text: `${route.obstacles} rough`, tone: 'warning' as const }] : []),
    // Solo en EVA: fuera del boxwork se camina sobre la grilla regional (10 m), con menos detalle
    ...(route.mode === 'eva' && (route.terrain_cell_m ?? 0) >= 10 ? [{ icon: 'grid_on', text: '10 m terrain', tone: 'info' as const }] : []),
  ];

  return (
    <div className="flex flex-col gap-sm rounded-lg border-2 border-accent bg-surface p-sm">
      <div className="flex items-center gap-sm">
        <span className={`h-1.5 w-4 shrink-0 rounded-full ${meta.swatch}`} />
        <p className="min-w-0 flex-1 truncate font-headline text-title-md text-on-surface">{meta.label}</p>
        <span className={`inline-flex shrink-0 items-center gap-xs font-body text-body-sm font-bold ${TEXT_TONE[tone]}`} title="Safety">
          <Icon name={SAFETY_FACE[tone]} className="text-[18px]" />
          <Live>{route.safety_pct}%</Live>
        </span>
      </div>

      <div className="grid grid-cols-3 gap-xs text-center">
        <Stat icon="schedule" label="Time" value={formatMinutes(route.duration_min)} />
        <Stat icon="straighten" label="Distance" value={formatDistance(route.distance_m)} />
        <Stat icon={battery ? 'battery_charging_full' : 'air'} label={battery ? 'Battery' : 'O₂'} value={`${Math.round(left)}%`}>
          <Meter value={left} tone={toneForRemaining(left)} label={battery ? 'Battery left' : 'Oxygen left'} className="mt-xs h-1" />
        </Stat>
      </div>

      {route.reserve_min != null && (
        <p className="flex items-center justify-between rounded-md bg-surface-container px-sm py-xs font-body text-body-sm text-on-surface-variant">
          <span className="flex items-center gap-xs">
            <Icon name="u_turn_left" className="text-[16px] text-accent" />
            Return reserve
          </span>
          <Live className={`font-mono text-mono-sm font-bold ${route.reserve_min < 0 ? 'text-error' : 'text-on-surface'}`}>
            {route.reserve_min.toFixed(1)} {route.resource.unit}
          </Live>
        </p>
      )}

      {chips.length > 0 && (
        <ul className="flex flex-wrap gap-xs">
          {chips.map((c) => (
            <li key={c.text} className={`inline-flex items-center gap-xs rounded-full px-sm py-[2px] font-body text-body-sm ${CHIP_TONE[c.tone]}`}>
              <Icon name={c.icon} className="text-[14px]" />
              <span>{c.text}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const CHIP_TONE: Record<Chip['tone'], string> = {
  warning: 'bg-warning/15 text-warning',
  error: 'bg-error/15 text-error',
  info: 'bg-surface-container-high text-on-surface-variant',
};

function Stat({ icon, label, value, children }: { icon: string; label: string; value: string; children?: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col items-center rounded-md bg-surface-container px-xs py-sm">
      <Icon name={icon} className="text-[20px] text-accent" />
      <Live className="font-mono text-mono-md text-on-surface">{value}</Live>
      <span className="font-label text-label-sm uppercase text-on-surface-variant">{label}</span>
      {children && <div className="w-full px-xs">{children}</div>}
    </div>
  );
}

/** Otra opción, en una fila: nombre y en qué se diferencia de la elegida. */
export function RouteAlternative({ route, current, onSelect }: { route: RoutePlan; current: RoutePlan; onSelect: () => void }) {
  const meta = PROFILE_META[route.profile];
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex min-h-[44px] w-full items-center gap-sm rounded-lg border border-outline bg-surface p-sm text-left transition-colors duration-fast hover:border-accent"
    >
      <span className={`h-1.5 w-4 shrink-0 rounded-full ${meta.swatch}`} />
      <span className="min-w-0 flex-1">
        <span className="block font-headline text-title-md text-on-surface">{meta.label}</span>
        <Phrase className="block font-body text-body-sm text-on-surface-variant">{compare(route, current)}</Phrase>
      </span>
      <Icon name="chevron_right" className="shrink-0 text-[20px] text-on-surface-variant" />
    </button>
  );
}

/** "−4 min · +0.3 km · less safe" frente a la ruta elegida. */
function compare(route: RoutePlan, current: RoutePlan): string {
  const parts: string[] = [];
  const dt = route.duration_min - current.duration_min;
  if (Math.abs(dt) >= 0.5) parts.push(`${dt < 0 ? '−' : '+'}${formatMinutes(Math.abs(dt))}`);
  const dd = route.distance_m - current.distance_m;
  if (Math.abs(dd) >= 10) parts.push(`${dd < 0 ? '−' : '+'}${formatDistance(Math.abs(dd))}`);
  const ds = route.safety_pct - current.safety_pct;
  if (Math.abs(ds) >= 1) parts.push(ds < 0 ? 'less safe' : 'safer');
  return parts.length ? parts.join(' · ') : PROFILE_META[route.profile].hint;
}
