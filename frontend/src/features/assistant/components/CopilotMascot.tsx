import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { Availability } from '../types';

/**
 * El agente de SENDA animado: al pulsarlo se abre el copiloto y se puede arrastrar a cualquier
 * parte de la pantalla (la posición se recuerda en este navegador).
 *
 * Cada situación tiene su animación en frontend/public/assets/mascot/<archivo>.webp, generada con
 * tools/mascot/optimize.py a partir de los originales de design/mascot/ (todas en el mismo lienzo
 * y a la misma escala, así que al cambiar de una a otra el robot no salta).
 */
export type MascotMood = 'greeting' | 'idle' | 'thinking' | 'celebrating' | 'tired' | 'waking';

const FILE: Record<MascotMood, string> = {
  greeting: 'saludo',
  idle: 'flotando',
  thinking: 'pensando',
  celebrating: 'celebrando',
  tired: 'cansado',
  waking: 'despierta',
};

// Las animaciones de una sola vez vuelven al reposo al terminar (duración del original)
const ONCE_MS: Partial<Record<MascotMood, number>> = { greeting: 5200, celebrating: 4000, waking: 8000 };

const BUBBLE: Record<MascotMood, string> = {
  greeting: 'Hi! Tap me to plan your outing',
  idle: 'Tap me to plan · drag me anywhere',
  thinking: 'Working on it…',
  celebrating: 'Plan ready on the map!',
  tired: 'Copilot is offline here',
  waking: "I'm back online!",
};

const src = (mood: MascotMood) => `/assets/mascot/${FILE[mood]}.webp`;

const SIZE = { w: 96, h: 120 };    // tamaño en pantalla: la mitad del lienzo de las animaciones (192x241)
const MARGIN = 8;
const DRAG_THRESHOLD = 5;          // px: menos que esto es un clic, no un arrastre
const STORAGE_KEY = 'senda.mascot.position';

interface Position {
  x: number;
  y: number;
}

function clamp(p: Position): Position {
  return {
    x: Math.min(Math.max(MARGIN, p.x), window.innerWidth - SIZE.w - MARGIN),
    y: Math.min(Math.max(MARGIN, p.y), window.innerHeight - SIZE.h - MARGIN),
  };
}

function initialPosition(): Position {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Position | null;
    if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) return clamp(saved);
  } catch {
    // sin almacenamiento (modo privado): se usa la esquina por defecto
  }
  return clamp({ x: 16, y: window.innerHeight - SIZE.h - 16 });   // abajo a la izquierda
}

/** Estado de ánimo: lo que pasa ahora manda; las animaciones de una vez se superponen un rato. */
function useMood(busy: boolean, availability: Availability, planned: number): MascotMood {
  const [once, setOnce] = useState<MascotMood | null>('greeting');
  const offline = availability !== 'ready' && availability !== 'checking';
  const wasOffline = useRef(offline);
  const lastPlanned = useRef(planned);

  useEffect(() => {
    if (wasOffline.current && !offline) setOnce('waking');   // vuelve a estar disponible
    wasOffline.current = offline;
  }, [offline]);

  useEffect(() => {
    if (planned > lastPlanned.current) setOnce('celebrating');   // salió un plan nuevo
    lastPlanned.current = planned;
  }, [planned]);

  useEffect(() => {
    if (!once) return;
    const id = window.setTimeout(() => setOnce(null), ONCE_MS[once] ?? 4000);
    return () => window.clearTimeout(id);
  }, [once]);

  if (busy) return 'thinking';
  if (offline) return 'tired';
  return once ?? 'idle';
}

export function CopilotMascot({
  open,
  busy,
  availability,
  plannedCount,
  onClick,
}: {
  open: boolean;
  busy: boolean;
  availability: Availability;
  /** Cuántas salidas ha planificado el copiloto (al subir, celebra). */
  plannedCount: number;
  onClick: () => void;
}) {
  const [pos, setPos] = useState<Position>(initialPosition);
  const [hover, setHover] = useState(false);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ dx: number; dy: number; startX: number; startY: number; moved: boolean } | null>(null);
  const mood = useMood(busy, availability, plannedCount);
  const shown: MascotMood = dragging ? 'idle' : mood;

  // Precarga el resto cuando el navegador está libre: cambiar de animación no parpadea
  useEffect(() => {
    const preload = () => Object.keys(FILE).forEach((m) => (new Image().src = src(m as MascotMood)));
    const w = window as Window & { requestIdleCallback?: (cb: () => void) => number };
    if (w.requestIdleCallback) w.requestIdleCallback(preload);
    else window.setTimeout(preload, 2000);
  }, []);

  // Si la ventana cambia de tamaño, el robot no queda fuera de la pantalla
  useEffect(() => {
    const onResize = () => setPos((p) => clamp(p));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const onPointerDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y, startX: e.clientX, startY: e.clientY, moved: false };
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < DRAG_THRESHOLD) return;
    d.moved = true;
    setDragging(true);
    setPos(clamp({ x: e.clientX - d.dx, y: e.clientY - d.dy }));
  };

  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.moved) {
      setDragging(false);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
      } catch {
        // sin almacenamiento: la posición vale solo para esta visita
      }
    } else {
      onClick();   // fue un clic, no un arrastre
    }
  };

  // El bocadillo va hacia el lado con más espacio
  const bubbleLeft = pos.x + SIZE.w / 2 > window.innerWidth / 2;
  const showBubble = !dragging && (hover || busy || mood === 'celebrating' || mood === 'waking');

  return (
    <button
      type="button"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        drag.current = null;
        setDragging(false);
      }}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onClick())}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
      aria-expanded={open}
      aria-label={open ? 'Close SENDA Copilot' : 'Open SENDA Copilot'}
      title={BUBBLE[shown]}
      style={{ left: pos.x, top: pos.y, width: SIZE.w, height: SIZE.h, touchAction: 'none' }}
      className={`group fixed z-40 select-none rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-accent ${
        dragging ? 'cursor-grabbing' : 'cursor-grab transition-opacity duration-standard'
      } ${open ? 'pointer-events-none opacity-0' : 'opacity-100'}`}
    >
      <img
        src={src(shown)}
        alt=""
        width={SIZE.w}
        height={SIZE.h}
        draggable={false}
        className={`h-full w-full object-contain drop-shadow-[0_8px_18px_rgba(0,0,0,0.55)] transition-transform duration-standard ease-standard ${
          dragging ? 'scale-110' : 'group-hover:-translate-y-1 group-hover:scale-105'
        }`}
      />
      {/* Bocadillo: dice qué pasa al pulsar o qué está haciendo */}
      <span
        className={`pointer-events-none absolute top-[18%] whitespace-nowrap rounded-xl border border-accent/50 bg-surface-container-high/95 px-sm py-xs font-body text-body-sm text-on-surface shadow-xl transition-opacity duration-standard ${
          bubbleLeft ? 'right-full mr-xs rounded-br-sm' : 'left-full ml-xs rounded-bl-sm'
        } ${showBubble ? 'opacity-100' : 'opacity-0'}`}
      >
        {BUBBLE[shown]}
      </span>
    </button>
  );
}
