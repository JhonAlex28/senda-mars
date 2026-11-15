import { http } from '@/shared/api/httpClient';
import { config } from '@/shared/config/env';
import type { GeoPoint } from '@/shared/types/geo';

export type Leg = 'eva' | 'rover';

/** Espejo de ReturnFieldResponse (GET /return-field). */
export interface ReturnFieldMeta {
  leg: Leg;
  scenario: string;
  bbox_lonlat: [number, number, number, number];
  unit: string;
  max_value: number;
  source_id: string;
}

function query(leg: Leg, at?: GeoPoint | null): string {
  const p = new URLSearchParams({ leg });
  if (leg === 'eva' && at) {
    p.set('lon', String(at.lon));
    p.set('lat', String(at.lat));
  }
  return p.toString();
}

export const safetyApi = {
  /** Metadatos del campo de retorno: EVA hacia el vehículo estacionado en `at`, o vehículo hacia la base. */
  returnField: (leg: Leg, at?: GeoPoint | null) => http.get<ReturnFieldMeta>(`/return-field?${query(leg, at)}`),
  /** PNG de la zona desde la que se puede volver con margen (misma base de URL que la API). */
  safeMaskUrl: (leg: Leg, at?: GeoPoint | null) => `${config.apiBaseUrl}/return-field/safe-mask.png?${query(leg, at)}`,
};
