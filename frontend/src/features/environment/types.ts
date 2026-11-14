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
