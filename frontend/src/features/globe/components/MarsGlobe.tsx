import type { ReactNode } from 'react';

const SIZE = 440;
const R = SIZE / 2;

/**
 * Globo de Marte dibujado con SVG (sin imágenes externas): gradiente oxidado, textura de
 * ruido que se desplaza lentamente para simular la rotación y sombreado esférico.
 */
export function MarsGlobe({ children }: { children?: ReactNode }) {
  return (
    <div className="relative" style={{ width: SIZE, height: SIZE }}>
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="absolute inset-0 h-full w-full" aria-hidden="true">
        <defs>
          <radialGradient id="mars-base" cx="45%" cy="40%" r="65%">
            <stop offset="0%" stopColor="#E38A55" />
            <stop offset="45%" stopColor="#C2562C" />
            <stop offset="80%" stopColor="#7E2F17" />
            <stop offset="100%" stopColor="#3C140A" />
          </radialGradient>
          <radialGradient id="mars-shade" cx="32%" cy="28%" r="80%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.22" />
            <stop offset="40%" stopColor="#FFFFFF" stopOpacity="0" />
            <stop offset="85%" stopColor="#070D17" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#070D17" stopOpacity="0.85" />
          </radialGradient>
          <filter id="mars-noise" x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.011 0.018" numOctaves="5" seed="11" />
            <feColorMatrix type="saturate" values="0" />
            <feComponentTransfer>
              <feFuncA type="table" tableValues="0 0.9" />
            </feComponentTransfer>
          </filter>
          <clipPath id="mars-clip">
            <circle cx={R} cy={R} r={R - 1} />
          </clipPath>
        </defs>

        <circle cx={R} cy={R} r={R - 1} fill="url(#mars-base)" />
        <g clipPath="url(#mars-clip)">
          <g style={{ mixBlendMode: 'multiply' }} opacity={0.55}>
            <rect x={0} y={0} width={SIZE * 4} height={SIZE} filter="url(#mars-noise)" />
            <animateTransform
              attributeName="transform"
              type="translate"
              values={`0 0; ${-SIZE * 2} 0; 0 0`}
              dur="240s"
              repeatCount="indefinite"
              calcMode="spline"
              keySplines="0.4 0 0.6 1; 0.4 0 0.6 1"
            />
          </g>
          {/* Casquete polar sur */}
          <ellipse cx={R + 20} cy={SIZE - 8} rx={95} ry={26} fill="#F4E6DC" opacity={0.55} />
          {/* Valles Marineris, sugerido */}
          <path d={`M ${R - 150} ${R - 10} C ${R - 80} ${R - 30}, ${R - 20} ${R + 5}, ${R + 70} ${R - 15}`} stroke="#5A2010" strokeWidth={5} strokeOpacity={0.45} fill="none" strokeLinecap="round" />
        </g>
        <circle cx={R} cy={R} r={R - 1} fill="url(#mars-shade)" />
        <circle cx={R} cy={R} r={R - 1} fill="none" stroke="#1F3352" strokeOpacity={0.6} />
      </svg>
      {children}
    </div>
  );
}
