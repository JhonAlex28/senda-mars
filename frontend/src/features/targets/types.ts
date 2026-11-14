/** Espejo del DTO TargetOut del backend (adapters/inbound/http/schemas.py). */
export interface Rubric {
  novelty: number;
  habitability: number;
  human_only: number;
  total: number;
}

export interface Target {
  id: string;
  name: string;
  lon: number;
  lat: number;
  elevation_m: number;
  category: string;
  description: string;
  rubric: Rubric;
}
