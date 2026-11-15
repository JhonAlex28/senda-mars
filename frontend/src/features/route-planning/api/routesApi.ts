import { http } from '@/shared/api/httpClient';
import type { GeoPoint } from '@/shared/types/geo';
import type { RoutePlan, RouteProfile, Scenario, TravelMode, TraversePlan, Waypoint } from '../types';

export const routesApi = {
  /** Rover: base → estacionamientos → base (tres alternativas). */
  traverse: (base: GeoPoint, targetIds: string[], scenario: Scenario) =>
    http.post<TraversePlan>('/routes/traverse', { base, target_ids: targetIds, ...scenario }),

  /** EVA: rover → objetivos → rover (tres alternativas). */
  eva: (rover: GeoPoint, targetIds: string[], scenario: Scenario) =>
    http.post<RoutePlan[]>('/routes/eva', { rover, target_ids: targetIds, ...scenario }),

  /** Ruta por waypoints arbitrarios (contingencias y retornos). */
  path: (mode: TravelMode, waypoints: Waypoint[], scenario: Scenario, profiles?: RouteProfile[]) =>
    http.post<RoutePlan[]>('/routes/path', { mode, waypoints, profiles, ...scenario }),
};
