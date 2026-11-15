import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import { clamp } from '@/shared/lib/format';
import type { Rect } from '../lib/projection';

const DRAG_THRESHOLD_PX = 4;
const WHEEL_STEP = 1.2;
const MIN_WIDTH_M = 40;
const ANIMATION_MS = 450;

/**
 * Zoom con la rueda (hacia el cursor), arrastre para desplazar y encuadre animado.
 * `unit` = metros por píxel de pantalla, para dibujar marcadores de tamaño constante.
 */
export function usePanZoom(world: { width: number; height: number }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [view, setView] = useState<Rect>({ x: 0, y: 0, w: world.width, h: world.height });
  const [size, setSize] = useState({ w: 1, h: 1 });
  const viewRef = useRef(view);
  viewRef.current = view;
  const drag = useRef<{ x: number; y: number; view: Rect; moved: boolean } | null>(null);
  const lastDragMoved = useRef(false);
  const animation = useRef<number>(0);

  const unit = Math.max(view.w / size.w, view.h / size.h);
  const maxWidth = world.width * 1.6;

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const observer = new ResizeObserver(([entry]) =>
      setSize({ w: entry.contentRect.width || 1, h: entry.contentRect.height || 1 }),
    );
    observer.observe(svg);
    return () => observer.disconnect();
  }, []);

  const clientToWorld = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return { x: 0, y: 0 };
    const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  }, []);

  const animateTo = useCallback((target: Rect) => {
    cancelAnimationFrame(animation.current);
    const from = viewRef.current;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / ANIMATION_MS);
      const e = 1 - (1 - t) ** 3; // ease-out
      setView({
        x: from.x + (target.x - from.x) * e,
        y: from.y + (target.y - from.y) * e,
        w: from.w + (target.w - from.w) * e,
        h: from.h + (target.h - from.h) * e,
      });
      if (t < 1) animation.current = requestAnimationFrame(step);
    };
    animation.current = requestAnimationFrame(step);
  }, []);

  const zoomAt = useCallback(
    (factor: number, center?: { x: number; y: number }) => {
      const v = viewRef.current;
      const c = center ?? { x: v.x + v.w / 2, y: v.y + v.h / 2 };
      const w = clamp(v.w * factor, MIN_WIDTH_M, maxWidth);
      const s = w / v.w;
      return { x: c.x - (c.x - v.x) * s, y: c.y - (c.y - v.y) * s, w, h: v.h * s };
    },
    [maxWidth],
  );

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      cancelAnimationFrame(animation.current);
      setView(zoomAt(e.deltaY > 0 ? WHEEL_STEP : 1 / WHEEL_STEP, clientToWorld(e.clientX, e.clientY)));
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, [zoomAt, clientToWorld]);

  const onPointerDown = (e: PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    cancelAnimationFrame(animation.current);
    drag.current = { x: e.clientX, y: e.clientY, view: viewRef.current, moved: false };
  };

  const onPointerMove = (e: PointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
    if (!d.moved) {
      d.moved = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    setView({ ...d.view, x: d.view.x - dx * unit, y: d.view.y - dy * unit });
  };

  const onPointerUp = () => {
    lastDragMoved.current = drag.current?.moved ?? false;
    drag.current = null;
  };

  /** Encuadra un rectángulo del mundo con un margen proporcional. */
  const fit = useCallback(
    (rect: Rect, padding = 0.15) => {
      const w = Math.max(rect.w * (1 + padding * 2), MIN_WIDTH_M);
      const h = Math.max(rect.h * (1 + padding * 2), MIN_WIDTH_M);
      const aspect = size.w / size.h;
      const fw = Math.max(w, h * aspect);
      const fh = fw / aspect;
      animateTo({ x: rect.x + rect.w / 2 - fw / 2, y: rect.y + rect.h / 2 - fh / 2, w: fw, h: fh });
    },
    [animateTo, size.w, size.h],
  );

  return {
    svgRef,
    view,
    unit,
    size,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerLeave: onPointerUp },
    /** true si el último gesto fue un arrastre (para no tratarlo como clic). */
    wasDrag: () => lastDragMoved.current,
    clientToWorld,
    fit,
    zoomIn: () => animateTo(zoomAt(1 / 1.6)),
    zoomOut: () => animateTo(zoomAt(1.6)),
  };
}
