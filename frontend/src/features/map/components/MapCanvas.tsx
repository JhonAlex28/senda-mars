import { useEffect, type MouseEvent, type ReactNode } from 'react';
import type { BBox, GeoPoint } from '@/shared/types/geo';
import { Icon } from '@/shared/ui/Icon';
import type { TerrainLayer } from '@/features/terrain';
import { MapContext } from '../context/MapContext';
import { usePanZoom } from '../hooks/usePanZoom';
import type { Projection } from '../lib/projection';
import { ScaleBar } from './ScaleBar';

const FOCUS_PADDING = 0.03;

interface MapCanvasProps {
  projection: Projection;
  terrain: (TerrainLayer | null)[];
  /** Al cambiar, la vista se encuadra en esta caja (animado). */
  focus: BBox | null;
  cursor?: string;
  onMapClick?: (p: GeoPoint) => void;
  onPointerMoveGeo?: (p: GeoPoint) => void;
  overlay?: ReactNode;
  children: ReactNode;
}

/** Lienzo del mapa: terreno sombreado + capas SVG en metros, con zoom y desplazamiento. */
export function MapCanvas({
  projection,
  terrain,
  focus,
  cursor = 'grab',
  onMapClick,
  onPointerMoveGeo,
  overlay,
  children,
}: MapCanvasProps) {
  const { svgRef, view, unit, size, handlers, wasDrag, clientToWorld, fit, zoomIn, zoomOut } = usePanZoom(projection);
  const focusKey = focus ? Object.values(focus).join(',') : '';

  useEffect(() => {
    if (focus && size.w > 1) fit(projection.rectOf(focus), FOCUS_PADDING);
    // se reencuadra solo cuando cambia la caja de foco o el tamaño inicial del lienzo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey, size.w > 1]);

  const handleClick = (e: MouseEvent<SVGSVGElement>) => {
    if (!onMapClick || wasDrag()) return;
    const { x, y } = clientToWorld(e.clientX, e.clientY);
    onMapClick(projection.toGeo(x, y));
  };

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#0d0908]">
      {/* Etiquetas del mapa (T05, P1…) en cajas de tamaño fijo: el traductor no debe cambiarlas */}
      <div translate="no" className="notranslate h-full w-full">
        <svg
          ref={svgRef}
          viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
          preserveAspectRatio="xMidYMid meet"
          className="h-full w-full touch-none select-none"
          style={{ cursor }}
          onClick={handleClick}
          onMouseMove={
            onPointerMoveGeo
              ? (e) => {
                  const { x, y } = clientToWorld(e.clientX, e.clientY);
                  onPointerMoveGeo(projection.toGeo(x, y));
                }
              : undefined
          }
          {...handlers}
          role="application"
          aria-label="Terrain map. Scroll to zoom, drag to move."
        >
          {terrain.map((layer, i) => {
            if (!layer) return null;
            const r = projection.rectOf(layer.grid.bbox);
            return (
              <image
                key={i}
                href={layer.image}
                x={r.x}
                y={r.y}
                width={r.w}
                height={r.h}
                preserveAspectRatio="none"
                opacity={i === 0 ? 0.92 : 1}
              />
            );
          })}
          <MapContext.Provider value={{ projection, unit, focusOn: (b) => fit(projection.rectOf(b)) }}>{children}</MapContext.Provider>
        </svg>
      </div>

      {overlay}

      <div className="absolute bottom-md right-md z-20 flex flex-col overflow-hidden rounded-md border border-outline bg-surface-container/95">
        <button type="button" onClick={zoomIn} aria-label="Zoom in" className="p-xs text-on-surface hover:text-accent">
          <Icon name="add" className="text-[20px]" />
        </button>
        <button type="button" onClick={zoomOut} aria-label="Zoom out" className="border-t border-outline p-xs text-on-surface hover:text-accent">
          <Icon name="remove" className="text-[20px]" />
        </button>
        <button
          type="button"
          onClick={() => fit(focus ? projection.rectOf(focus) : { x: 0, y: 0, w: projection.width, h: projection.height }, FOCUS_PADDING)}
          aria-label="Reset view"
          className="border-t border-outline p-xs text-on-surface hover:text-accent"
        >
          <Icon name="fit_screen" className="text-[20px]" />
        </button>
      </div>
      <ScaleBar unit={unit} />
    </div>
  );
}
