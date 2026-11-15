import type { Tone } from '@/shared/ui/Meter';
import type { RoutePlan, RouteProfile } from '../types';

interface ProfileMeta {
  label: string;
  hint: string;
  color: string; // trazo en el mapa
  swatch: string; // clase Tailwind de la muestra de color
  dashed: boolean;
}

export const PROFILE_META: Record<RouteProfile, ProfileMeta> = {
  safe: {
    label: 'Safest route',
    hint: 'Stays away from steep and rough ground.',
    color: '#22C55E',
    swatch: 'bg-route-safe',
    dashed: false,
  },
  scientific: {
    label: 'Science route',
    hint: 'Goes past more interesting rocks on the way.',
    color: '#D9532B',
    swatch: 'bg-primary',
    dashed: true,
  },
  fast: {
    label: 'Quickest route',
    hint: 'Takes the least time. The ground can be rougher.',
    color: '#3B82F6',
    swatch: 'bg-route-fast',
    dashed: false,
  },
};

export const PROFILE_ORDER: RouteProfile[] = ['safe', 'scientific', 'fast'];

export type SafetyTone = Extract<Tone, 'success' | 'warning' | 'error'>;

export function safetyTone(pct: number): SafetyTone {
  if (pct >= 80) return 'success';
  return pct >= 50 ? 'warning' : 'error';
}

export const SAFETY_FACE: Record<SafetyTone, string> = {
  success: 'sentiment_very_satisfied',
  warning: 'sentiment_neutral',
  error: 'sentiment_very_dissatisfied',
};

export function routeFor(routes: RoutePlan[], profile: RouteProfile): RoutePlan | undefined {
  return routes.find((r) => r.profile === profile);
}

/** Dos rutas son "la misma" si su recorrido apenas cambia (el A* puede dar el mismo camino con perfiles distintos). */
export function sameRoute(a: RoutePlan, b: RoutePlan): boolean {
  return Math.abs(a.distance_m - b.distance_m) < 10 && Math.abs(a.duration_min - b.duration_min) < 0.5 && a.safety_pct === b.safety_pct;
}

/** Perfiles con un camino propio: la ruta elegida primero y luego las que se diferencian de ella y entre sí. */
export function distinctProfiles(routes: RoutePlan[], selected: RouteProfile): RouteProfile[] {
  const kept: RoutePlan[] = [];
  const first = routeFor(routes, selected);
  for (const route of [first, ...PROFILE_ORDER.map((p) => routeFor(routes, p))]) {
    if (route && !kept.some((k) => sameRoute(k, route))) kept.push(route);
  }
  return kept.map((r) => r.profile);
}
