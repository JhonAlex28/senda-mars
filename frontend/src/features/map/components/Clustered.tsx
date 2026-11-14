import type { ReactNode } from 'react';
import { bboxAround } from '@/shared/lib/geo';
import type { GeoPoint } from '@/shared/types/geo';
import { useMap } from '../context/MapContext';
import { clusterByScreenDistance } from '../lib/cluster';
import { ClusterMarker } from './markers';

const MIN_SEPARATION_PX = 26;
const ZOOM_MARGIN_M = 25;

interface ClusteredProps<T extends GeoPoint & { id: string }> {
  items: T[];
  renderItem: (item: T) => ReactNode;
  /** Resalta el grupo (p. ej. si contiene objetivos elegidos). */
  highlight?: (item: T) => boolean;
}

/** Dibuja cada punto o, si se solapan con el zoom actual, una burbuja que acerca al tocarla. */
export function Clustered<T extends GeoPoint & { id: string }>({ items, renderItem, highlight }: ClusteredProps<T>) {
  const { projection, unit, focusOn } = useMap();
  return (
    <>
      {clusterByScreenDistance(items, projection, unit, MIN_SEPARATION_PX).map((c) =>
        c.items.length === 1 ? (
          <g key={c.items[0].id}>{renderItem(c.items[0])}</g>
        ) : (
          <ClusterMarker
            key={c.items.map((i) => i.id).join('-')}
            point={c.center}
            ids={c.items.map((i) => i.id)}
            highlighted={!!highlight && c.items.some(highlight)}
            onClick={() => focusOn(bboxAround(c.items, ZOOM_MARGIN_M))}
          />
        ),
      )}
    </>
  );
}
