import { routeFor, type Parking, type RoutePlan } from '@/features/route-planning';
import type { MissionState, PlanStep } from './types';

export function selectedTraverse(s: MissionState): RoutePlan | undefined {
  return s.traverse ? routeFor(s.traverse.routes, s.traverseProfile) : undefined;
}

export function selectedEva(s: MissionState, parkingId: string): RoutePlan | undefined {
  const plan = s.evaPlans[parkingId];
  return plan ? routeFor(plan.routes, plan.profile) : undefined;
}

export function activeParking(s: MissionState): Parking | undefined {
  return s.traverse?.parkings.find((p) => p.id === s.activeParkingId);
}

export function allEvasPlanned(s: MissionState): boolean {
  return !!s.traverse && s.traverse.parkings.every((p) => s.evaPlans[p.id]);
}

export function planStep(s: MissionState): PlanStep {
  if (!s.baseConfirmed) return 'base';
  if (s.goals.length === 0) return 'goals';
  if (!s.traverse) return 'traverse';
  return allEvasPlanned(s) ? 'ready' : 'eva';
}

/** Recurso más ajustado de todo el plan (para el aviso de retorno). */
export function planReserve(s: MissionState): { batteryPct: number; minO2Pct: number; returnOk: boolean } | null {
  const rover = selectedTraverse(s);
  if (!rover || !s.traverse) return null;
  const walks = s.traverse.parkings.map((p) => selectedEva(s, p.id)).filter((r): r is RoutePlan => !!r);
  return {
    batteryPct: rover.resource.remaining_pct,
    minO2Pct: Math.min(100, ...walks.map((w) => w.resource.remaining_pct)),
    returnOk: rover.return_ok && walks.every((w) => w.return_ok),
  };
}
