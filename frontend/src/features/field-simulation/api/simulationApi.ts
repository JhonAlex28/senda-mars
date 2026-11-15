import { http } from '@/shared/api/httpClient';
import type { ScenarioInfo, SimulateRequest, SimulateResponse } from '../types';

export const simulationApi = {
  simulate: (req: SimulateRequest) =>
    http<SimulateResponse>('/simulate', { method: 'POST', body: JSON.stringify(req) }),
  scenarios: () => http<ScenarioInfo[]>('/scenarios'),
};
