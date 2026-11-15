import { http } from '@/shared/api/httpClient';
import type {
  MissionRequest, MissionResponse, ReturnFieldResponse, RoutesRequest, RoutesResponse,
  ScenarioId, Traverse,
} from '../types';

const post = <T>(path: string, body: unknown) =>
  http<T>(path, { method: 'POST', body: JSON.stringify(body) });

export const plannerApi = {
  planMission: (req: MissionRequest) => post<MissionResponse>('/mission/plan', req),
  planRoutes: (req: RoutesRequest) => post<RoutesResponse>('/routes', req),
  planTraverse: (from?: [number, number], to?: [number, number] | string) =>
    post<Traverse>('/traverse', { from, to }),
  returnField: (leg: 'eva' | 'rover' = 'eva', scenario: ScenarioId = 'none') =>
    http<ReturnFieldResponse>(`/return-field?leg=${leg}&scenario=${scenario}`),
};
