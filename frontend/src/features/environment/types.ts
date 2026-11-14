/** Espejo del DTO EnvironmentOut del backend. */
export interface Environment {
  sol: number;
  ls_deg: number;
  local_solar_time: string;
  pressure_pa: number;
  temp_min_c: number;
  temp_max_c: number;
  details: Record<string, unknown>;
}

export type Verdict = 'go' | 'caution' | 'no_go';

/** Espejo de CheckOut / ReadinessOut. */
export interface Check {
  key: 'temperature' | 'wind' | 'dust' | 'radiation';
  label: string;
  value: number;
  unit: string;
  verdict: Verdict;
  source: string;
}

export interface Readiness {
  verdict: Verdict;
  sol: number;
  local_solar_time: string;
  checks: Check[];
}
