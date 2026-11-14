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
    label: 'Easy path',
    hint: 'Avoids steep and risky ground.',
    color: '#22C55E',
    swatch: 'bg-route-safe',
    dashed: false,
  },
  scientific: {
    label: 'Smart path',
    hint: 'Passes close to your goals.',
    color: '#D9532B',
    swatch: 'bg-primary',
    dashed: true,
  },
  fast: {
    label: 'Fastest path',
    hint: 'Shortest time, rougher ground.',
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
