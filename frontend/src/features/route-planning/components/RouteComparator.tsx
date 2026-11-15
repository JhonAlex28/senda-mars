import { Card } from '@/shared/ui/Card';
import { Icon } from '@/shared/ui/Icon';
import { distinctProfiles, routeFor } from '../lib/profiles';
import type { RoutePlan, RouteProfile } from '../types';
import { RouteAlternative, RouteDetails } from './RouteOptionCard';

interface RouteComparatorProps {
  title: string;
  routes: RoutePlan[];
  selected: RouteProfile;
  onSelect: (profile: RouteProfile) => void;
}

/**
 * La ruta elegida en grande y, debajo, solo las opciones que de verdad son distintas.
 * Si todas dan el mismo camino se dice una vez, en lugar de repetir tres tarjetas iguales.
 */
export function RouteComparator({ title, routes, selected, onSelect }: RouteComparatorProps) {
  const current = routeFor(routes, selected) ?? routes[0];
  if (!current) return null;

  const others = distinctProfiles(routes, current.profile)
    .slice(1)
    .map((p) => routeFor(routes, p))
    .filter((r): r is RoutePlan => !!r);

  return (
    <Card title={title} className="gap-sm">
      <RouteDetails key={current.profile} route={current} />
      {others.length > 0 ? (
        <div className="flex flex-col gap-xs">
          <p className="font-label text-label-sm uppercase text-on-surface-variant">Other options</p>
          {others.map((route) => (
            <RouteAlternative key={route.profile} route={route} current={current} onSelect={() => onSelect(route.profile)} />
          ))}
        </div>
      ) : (
        <p className="flex items-start gap-xs font-body text-body-sm text-on-surface-variant">
          <Icon name="check" className="mt-px shrink-0 text-[16px] text-success" />
          <span>All options follow this path.</span>
        </p>
      )}
    </Card>
  );
}
