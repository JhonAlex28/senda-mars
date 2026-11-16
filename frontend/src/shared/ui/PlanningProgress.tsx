import { useEffect, useState } from 'react';
import { Icon } from './Icon';

/**
 * Aviso flotante mientras el planificador trabaja. La barra es visual: avanza rápido al inicio y
 * se frena cerca del final hasta que llega la respuesta, para que se vea que el sistema sigue
 * calculando (las rutas largas tardan varios segundos).
 */
export function PlanningProgress({ label }: { label: string }) {
  const [pct, setPct] = useState(4);

  useEffect(() => {
    const id = window.setInterval(() => setPct((p) => p + (92 - p) * 0.06), 120);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed left-1/2 top-[112px] z-40 w-[min(360px,calc(100%-2rem))] -translate-x-1/2 animate-fade-up rounded-lg border border-accent/60 bg-surface-container/95 px-md py-sm shadow-2xl backdrop-blur"
    >
      <p className="mb-xs flex items-center gap-sm font-headline text-title-md text-on-surface">
        <Icon name="progress_activity" className="animate-spin text-[20px] text-accent" />
        {label}
      </p>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-container-high">
        <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-[width] duration-150 ease-out" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
