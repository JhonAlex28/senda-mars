import { createContext, useContext } from 'react';
import type { BBox } from '@/shared/types/geo';
import type { Projection } from '../lib/projection';

export interface MapContextValue {
  projection: Projection;
  /** Metros por píxel de pantalla con el zoom actual. */
  unit: number;
  /** Acerca la vista (animado) a una caja geográfica. */
  focusOn: (bbox: BBox) => void;
}

export const MapContext = createContext<MapContextValue | null>(null);

export function useMap(): MapContextValue {
  const ctx = useContext(MapContext);
  if (!ctx) throw new Error('useMap must be used inside <MapCanvas>');
  return ctx;
}
