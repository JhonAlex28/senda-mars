import { http } from './httpClient';

/** Espejos de los DTOs de /api/v1/plans, /crew y /procedures (registro de la misión). */
export type PlanDay = 'today' | 'tomorrow' | number;

export interface SavedPlanSummary {
  targets: string[];
  total_duration_min: number;
  rover_profile?: string;
  battery_left_pct?: number;
  min_oxygen_left_pct?: number;
}

export interface SavedPlan<P = unknown> {
  id: string;
  title: string;
  sol: number;
  site_id: string;
  status: 'planned' | 'done';
  created_by: string | null;
  summary: Partial<SavedPlanSummary>;
  created_at: string | null;
  updated_at: string | null;
  payload: P | null;
}

export interface PlanInput<P = unknown> {
  title: string;
  day: PlanDay;
  site_id: string;
  created_by: string | null;
  status?: 'planned' | 'done';
  summary: Partial<SavedPlanSummary>;
  payload: P;
}

export interface CrewMemberDto {
  id: string;
  name: string;
  role: string;
  suit_id: string;
  resting_bpm: number;
  mass_kg: number;
}

export interface CrewDto {
  team_name: string;
  members: CrewMemberDto[];
}

export interface ProcedureDto {
  id: string;
  site_id: string;
  target_id: string;
  completed_at: string;
  crew_member: string | null;
  plan_id: string | null;
}

export const missionLogApi = {
  plans: (day?: PlanDay | 'all') =>
    http.get<{ today_sol: number; plans: SavedPlan[] }>(
      day === 'all' ? '/plans?all=true' : day === undefined ? '/plans' : `/plans?day=${day}`,
    ),
  plan: <P>(id: string) => http.get<SavedPlan<P>>(`/plans/${id}`),
  create: <P>(input: PlanInput<P>) => http.post<SavedPlan<P>>('/plans', input),
  update: <P>(id: string, input: PlanInput<P>) => http.put<SavedPlan<P>>(`/plans/${id}`, input),
  setStatus: (id: string, status: 'planned' | 'done') => http.patch<SavedPlan>(`/plans/${id}/status`, { status }),
  remove: (id: string) => http.delete(`/plans/${id}`),

  crew: () => http.get<CrewDto>('/crew'),
  saveCrew: (crew: CrewDto) => http.put<CrewDto>('/crew', crew),

  procedures: (siteId?: string) => http.get<ProcedureDto[]>(siteId ? `/procedures?site_id=${siteId}` : '/procedures'),
  recordProcedure: (input: Omit<ProcedureDto, 'id' | 'completed_at'>) => http.post<ProcedureDto>('/procedures', input),
};
