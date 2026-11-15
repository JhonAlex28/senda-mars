import { useEffect, type MouseEvent, type ReactNode } from 'react';
import type { BBox, GeoPoint } from '@/shared/types/geo';
import { Icon } from '@/shared/ui/Icon';
import { MapContext } from '../context/MapContext';
import { usePanZoom } from '../hooks/usePanZoom';
import type { Projection } from '../lib/projection';
import { ScaleBar } from './ScaleBar';

const FOCUS_PADDING = 0.03;

/** Imagen georreferenciada que se dibuja bajo las capas vectoriales (relieve, pendiente…). */
export interface Raster {
  key: string;
  image: string;
  bbox: BBox;
  opacity: number;
}

interface MapCanvasProps {
  projection: Projection;
  /** Se dibujan en orden: la primera queda abajo. */
  rasters: Raster[];
  /** Al cambiar, la vista se encuadra en esta caja (animado). */
  focus: BBox | null;
  cursor?: string;
  onMapClick?: (p: GeoPoint) => void;
  onPointerMoveGeo?: (p: GeoPoint) => void;
  overlay?: ReactNode;
  children: ReactNode;
}

/** Lienzo del mapa: imágenes ráster + capas SVG en metros, con zoom y desplazamiento. */
export function MapCanvas({
  projection,
  rasters,
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
    <div className="relative h-full w-full overflow-hidden bg-surface">
      {/* Full-bleed orbital Mars backdrop so widescreen viewports never show flat black bars */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-30 saturate-125"
        style={{
          backgroundImage: "url('/assets/mars_texture_8k.jpg')",
          filter: 'blur(2px) brightness(0.65)',
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 50% 50%, rgba(120, 58, 34, 0.14) 0%, rgba(11, 15, 22, 0.78) 78%, rgba(8, 11, 16, 0.94) 100%)',
        }}
      />
      {/* Etiquetas del mapa (T05, P1…) en cajas de tamaño fijo: el traductor no debe cambiarlas */}
      <div translate="no" className="notranslate relative z-10 h-full w-full">
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
          <defs>
            <pattern id="senda-gis-minor" width={100} height={100} patternUnits="userSpaceOnUse">
              <path d="M 100 0 L 0 0 0 100" fill="none" stroke="#4FC3F7" strokeOpacity="0.07" strokeWidth={0.8} />
            </pattern>
            <pattern id="senda-gis-major" width={500} height={500} patternUnits="userSpaceOnUse">
              <rect width={500} height={500} fill="url(#senda-gis-minor)" />
              <path d="M 500 0 L 0 0 0 500" fill="none" stroke="#F0883E" strokeOpacity="0.14" strokeWidth={1.4} />
            </pattern>
          </defs>
          {/* Seamless planetary GIS graticule extending beyond the DEM square */}
          <rect
            x={-projection.width * 4}
            y={-projection.height * 4}
            width={projection.width * 9}
            height={projection.height * 9}
            fill="url(#senda-gis-major)"
          />
          <circle
            cx={projection.width / 2}
            cy={projection.height / 2}
            r={projection.width * 0.85}
            fill="none"
            stroke="#4FC3F7"
            strokeOpacity="0.18"
            strokeWidth={1.5}
            strokeDasharray="10 8"
          />
          <rect
            x={0}
            y={0}
            width={projection.width}
            height={projection.height}
            fill="none"
            stroke="#4FC3F7"
            strokeOpacity="0.32"
            strokeWidth={1.5}
            strokeDasharray="6 4"
          />
          {rasters.map((raster) => {
            const r = projection.rectOf(raster.bbox);
            return (
              <image
                key={raster.key}
                href={raster.image}
                x={r.x}
                y={r.y}
                width={r.w}
                height={r.h}
                preserveAspectRatio="none"
                opacity={raster.opacity}
                style={{ imageRendering: 'auto' }}
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
