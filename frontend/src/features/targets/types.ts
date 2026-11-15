/** Espejo del DTO TargetOut del backend (adapters/inbound/http/schemas.py). */
export interface Rubric {
  novelty: number;
  habitability: number;
  human_only: number;
  total: number;
}

export interface ScienceTask {
  tool: string;
  duration_min: number;
  protocol: string;
}

export interface Target {
  id: string;
  name: string;
  lon: number;
  lat: number;
  elevation_m: number;
  category: string;
  description: string;
  is_base: boolean;
  rubric: Rubric;
  task: ScienceTask | null;
}
