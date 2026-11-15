import { useAsync } from '@/shared/hooks/useAsync';
import type { BBox, GeoPoint } from '@/shared/types/geo';
import { safetyApi, type Leg } from '../api/safetyApi';

export interface SafeReturnLayer {
  image: string;
  bbox: BBox;
}

/**
 * Zona de retorno seguro del motor de Mec. B: celdas desde las que se vuelve al vehículo
 * (EVA) o a la base (vehículo) con la reserva de seguridad. `enabled = false` → no se pide nada.
 */
export function useSafeReturn(leg: Leg, at: GeoPoint | null, enabled: boolean) {
  const key = enabled ? `${leg}:${at ? `${at.lon.toFixed(6)},${at.lat.toFixed(6)}` : '-'}` : 'off';
  const { data } = useAsync<SafeReturnLayer | null>(async () => {
    if (!enabled || (leg === 'eva' && !at)) return null;
    const meta = await safetyApi.returnField(leg, at);
    const [min_lon, min_lat, max_lon, max_lat] = meta.bbox_lonlat;
    return { image: safetyApi.safeMaskUrl(leg, at), bbox: { min_lon, min_lat, max_lon, max_lat } };
  }, [key]);
  return data;
}
