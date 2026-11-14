import { Card } from '@/shared/ui/Card';
import { PROFILE_ORDER, routeFor } from '../lib/profiles';
import type { RoutePlan, RouteProfile } from '../types';
import { RouteOptionCard } from './RouteOptionCard';

interface RouteComparatorProps {
  title: string;
  routes: RoutePlan[];
  selected: RouteProfile;
  onSelect: (profile: RouteProfile) => void;
}

/** Las tres alternativas lado a lado, siempre en el mismo orden (fácil → rápida). */
export function RouteComparator({ title, routes, selected, onSelect }: RouteComparatorProps) {
  return (
    <Card title={title} className="gap-xs">
      {PROFILE_ORDER.map((profile) => {
        const route = routeFor(routes, profile);
        return (
          route && (
            <RouteOptionCard
              key={profile}
              route={route}
              selected={profile === selected}
              onSelect={() => onSelect(profile)}
            />
          )
        );
      })}
    </Card>
  );
}
