import { useState } from 'react';
import type { Availability } from '../types';

/**
 * El agente de SENDA animado (abajo a la izquierda): al pulsarlo se abre el copiloto.
 *
 * Cada situación tiene su animación en frontend/public/assets/mascot/<archivo>.webp, generada con
 * tools/mascot/optimize.py a partir de los originales de design/mascot/. Mientras falte la de una
 * situación se usa la de saludo: para añadir una nueva basta con poner su archivo aquí.
 */
export type MascotMood = 'greeting' | 'thinking' | 'unavailable';

const ANIMATION: Record<MascotMood, string | null> = {
  greeting: 'saludo',
  thinking: null, // pendiente: animación "pensando" mientras el copiloto trabaja
  unavailable: null, // pendiente: animación para cuando el modelo no responde
};

const src = (mood: MascotMood) => `/assets/mascot/${ANIMATION[mood] ?? ANIMATION.greeting}.webp`;

function moodFor(busy: boolean, availability: Availability): MascotMood {
  if (busy) return 'thinking';
  if (availability === 'ready' || availability === 'checking') return 'greeting';
  return 'unavailable';
}

const BUBBLE: Record<MascotMood, string> = {
  greeting: 'Hi! Tap me to plan your outing',
  thinking: 'Working on it…',
  unavailable: 'Copilot is offline here',
};

export function CopilotMascot({
  open,
  busy,
  availability,
  onClick,
}: {
  open: boolean;
  busy: boolean;
  availability: Availability;
  onClick: () => void;
}) {
  const [hover, setHover] = useState(false);
  const mood = moodFor(busy, availability);
  const showBubble = hover || busy;

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
      aria-expanded={open}
      aria-label={open ? 'Close SENDA Copilot' : 'Open SENDA Copilot'}
      title={BUBBLE[mood]}
      className={`group fixed bottom-md left-md z-40 flex items-end rounded-2xl outline-none transition-all duration-standard focus-visible:ring-2 focus-visible:ring-accent ${
        open ? 'pointer-events-none translate-y-4 opacity-0' : 'opacity-100'
      }`}
    >
      <img
        src={src(mood)}
        alt=""
        width={95}
        height={120}
        draggable={false}
        className="h-[120px] w-auto drop-shadow-[0_8px_18px_rgba(0,0,0,0.55)] transition-transform duration-standard ease-standard group-hover:-translate-y-1 group-hover:scale-105"
      />
      {/* Bocadillo: dice qué pasa al pulsar (o que está trabajando) */}
      <span
        className={`mb-[78px] -ml-xs whitespace-nowrap rounded-xl rounded-bl-sm border border-accent/50 bg-surface-container-high/95 px-sm py-xs font-body text-body-sm text-on-surface shadow-xl transition-all duration-standard ${
          showBubble ? 'translate-x-0 opacity-100' : 'pointer-events-none -translate-x-1 opacity-0'
        }`}
      >
        {BUBBLE[mood]}
      </span>
    </button>
  );
}
