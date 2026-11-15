import { useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  title: string;
  text?: ReactNode;
  children: ReactNode;
  className?: string;
}

const WIDTH = 224; // w-56
const GAP = 8;

/**
 * Descripción al pasar el cursor o con foco de teclado, a la derecha del elemento (o a la izquierda si no cabe).
 * Se dibuja en un portal con posición fija: así no la recortan los paneles con scroll.
 * Siempre está en el DOM (solo se oculta), así el traductor del navegador la traduce una vez y no la rehace.
 */
export function Tooltip({ title, text, children, className = '' }: TooltipProps) {
  const anchor = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const show = () => {
    const r = anchor.current?.getBoundingClientRect();
    if (!r) return;
    const fitsRight = r.right + GAP + WIDTH <= window.innerWidth;
    setPos({ top: r.top + r.height / 2, left: fitsRight ? r.right + GAP : r.left - GAP - WIDTH });
  };
  const hide = () => setPos(null);

  return (
    <div ref={anchor} className={`relative flex ${className}`} onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}>
      {children}
      {createPortal(
        <div
          role="tooltip"
          style={{ top: pos?.top ?? 0, left: pos?.left ?? 0, width: WIDTH }}
          className={`pointer-events-none fixed z-50 -translate-y-1/2 rounded-md border border-outline bg-surface-container px-sm py-xs shadow-xl transition-opacity duration-fast ${
            pos ? 'visible opacity-100' : 'invisible opacity-0'
          }`}
        >
          <span className="block font-label text-label-sm uppercase text-on-surface">{title}</span>
          {text && <span className="block font-body text-body-sm text-on-surface-variant">{text}</span>}
        </div>,
        document.body,
      )}
    </div>
  );
}
