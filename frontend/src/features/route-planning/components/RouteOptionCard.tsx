import type { ReactNode } from 'react';
import { formatDistance, formatMinutes } from '@/shared/lib/format';
import { Icon } from '@/shared/ui/Icon';
import { Meter, TEXT_TONE, toneForRemaining } from '@/shared/ui/Meter';
import { Live, Phrase } from '@/shared/ui/Text';
import { PROFILE_META, SAFETY_FACE, safetyTone } from '../lib/profiles';
import type { RoutePlan } from '../types';

/** Pendiente a partir de la cual se avisa (igual que la precaución del backend). */
const STEEP_DEG = 10;

/** Ruta elegida: tres cifras clave grandes y avisos solo cuando hay algo que vigilar. */
export function RouteDetails({ route }: { route: RoutePlan }) {
  const meta = PROFILE_META[route.profile];
  const tone = safetyTone(route.safety_pct);
  const left = route.resource.remaining_pct;
  const battery = route.resource.name === 'battery';
  const warnings = [
    !route.return_ok && 'Not enough to come back',
    route.max_slope_deg >= STEEP_DEG && `Steep parts: ${Math.round(route.max_slope_deg)}°`,
    route.obstacles > 0 && `Rough spots: ${route.obstacles}`,
  ].filter((w): w is string => !!w);

  return (
    <div className="flex flex-col gap-sm rounded-lg border-2 border-accent bg-surface p-sm">
      <div className="flex items-center gap-sm" title={meta.hint}>
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
        <Stat icon={battery ? 'battery_charging_full' : 'air'} label={battery ? 'Battery' : 'Oxygen'} value={`${Math.round(left)}%`}>
          <Meter value={left} tone={toneForRemaining(left)} label={battery ? 'Battery left' : 'Oxygen left'} className="mt-xs h-1" />
        </Stat>
      </div>

      {warnings.length > 0 && (
        <ul className="flex flex-wrap gap-xs">
          {warnings.map((w) => (
            <li key={w} className="inline-flex items-center gap-xs rounded-full bg-warning/15 px-sm py-[2px] font-body text-body-sm text-warning">
              <Icon name="warning" className="text-[14px]" />
              <span>{w}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

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

/** Otra opción, en una fila: nombre, para qué sirve y en qué se diferencia de la elegida. */
export function RouteAlternative({ route, current, onSelect }: { route: RoutePlan; current: RoutePlan; onSelect: () => void }) {
  const meta = PROFILE_META[route.profile];
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full items-start gap-sm rounded-lg border border-outline bg-surface p-sm text-left transition-colors duration-fast hover:border-accent"
    >
      <span className={`mt-[7px] h-1.5 w-4 shrink-0 rounded-full ${meta.swatch}`} />
      <span className="min-w-0 flex-1">
        <span className="block font-headline text-title-md text-on-surface">{meta.label}</span>
        <Phrase className="block font-body text-body-sm text-on-surface-variant">{compare(route, current)}</Phrase>
      </span>
      <Icon name="chevron_right" className="mt-[2px] shrink-0 text-[20px] text-on-surface-variant" />
    </button>
  );
}

/** "4 min faster, 0.3 km longer, less safe" frente a la ruta elegida. */
function compare(route: RoutePlan, current: RoutePlan): string {
  const parts: string[] = [];
  const dt = route.duration_min - current.duration_min;
  if (Math.abs(dt) >= 0.5) parts.push(`${formatMinutes(Math.abs(dt))} ${dt < 0 ? 'faster' : 'slower'}`);
  const dd = route.distance_m - current.distance_m;
  if (Math.abs(dd) >= 10) parts.push(`${formatDistance(Math.abs(dd))} ${dd < 0 ? 'shorter' : 'longer'}`);
  const ds = route.safety_pct - current.safety_pct;
  if (Math.abs(ds) >= 1) parts.push(ds < 0 ? 'less safe' : 'safer');
  return parts.length ? `${capitalize(parts.join(', '))}.` : PROFILE_META[route.profile].hint;
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
