import type { MouseEvent } from 'react';
import type { GeoPoint } from '@/shared/types/geo';
import { useMap } from '../context/MapContext';

const COLORS = {
  primary: '#D9532B',
  accent: '#F0875A',
  surface: '#1E1514',
  outline: '#3D2B28',
  text: '#FFFFFF',
  success: '#22C55E',
  error: '#EF4444',
  muted: '#B8A9A7',
};

const stop = (handler?: () => void) => (e: MouseEvent) => {
  e.stopPropagation();
  handler?.();
};

/* ---------------- Rutas ---------------- */

interface RouteLineProps {
  points: GeoPoint[];
  color: string;
  width?: number; // píxeles de pantalla
  dashed?: boolean;
  dotted?: boolean;
  opacity?: number;
  halo?: boolean;
  onClick?: () => void;
}

export function RouteLine({ points, color, width = 3, dashed, dotted, opacity = 1, halo, onClick }: RouteLineProps) {
  const { projection } = useMap();
  const d = points.map((p) => projection.toXY(p)).map(({ x, y }) => `${x},${y}`).join(' ');
  const dash = dotted ? '1 7' : dashed ? '8 5' : undefined;
  return (
    <g opacity={opacity} onClick={onClick ? stop(onClick) : undefined} style={onClick ? { cursor: 'pointer' } : undefined}>
      {halo && (
        <polyline points={d} fill="none" stroke="#120D0D" strokeOpacity={0.7} strokeWidth={width + 4} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      )}
      {/* trazo invisible y ancho para que sea fácil hacer clic */}
      {onClick && <polyline points={d} fill="none" stroke="transparent" strokeWidth={14} vectorEffect="non-scaling-stroke" />}
      <polyline
        points={d}
        fill="none"
        stroke={color}
        strokeWidth={width}
        strokeDasharray={dash}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </g>
  );
}

/* ---------------- Objetivos científicos ---------------- */

export type TargetState = 'idle' | 'goal' | 'done' | 'skipped';

interface TargetMarkerProps {
  point: GeoPoint;
  id: string;
  name: string;
  state: TargetState;
  priority?: number;
  focused?: boolean;
  dimmed?: boolean;
  onClick?: () => void;
}

export function TargetMarker({ point, id, name, state, priority, focused, dimmed, onClick }: TargetMarkerProps) {
  const { projection, unit } = useMap();
  const { x, y } = projection.toXY(point);
  const r = 11 * unit;
  const ring = { idle: COLORS.muted, goal: COLORS.primary, done: COLORS.success, skipped: COLORS.outline }[state];
  return (
    <g
      transform={`translate(${x} ${y})`}
      onClick={stop(onClick)}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
      opacity={dimmed ? 0.45 : 1}
      role="button"
      aria-label={`${id} ${name}`}
    >
      <title>{`${id} · ${name}`}</title>
      {focused && <circle r={r * 1.9} fill={COLORS.accent} fillOpacity={0.18} stroke={COLORS.accent} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />}
      <circle r={r} fill={COLORS.surface} stroke={ring} strokeWidth={2} vectorEffect="non-scaling-stroke" />
      <text y={3.2 * unit} textAnchor="middle" fill={COLORS.text} fontFamily="Space Mono" fontSize={8.5 * unit}>
        {state === 'done' ? '✓' : id}
      </text>
      {priority !== undefined && state !== 'done' && (
        <g transform={`translate(${r * 0.95} ${-r * 0.95})`}>
          <circle r={6.5 * unit} fill={COLORS.primary} />
          <text y={3 * unit} textAnchor="middle" fill="#161616" fontFamily="Space Grotesk" fontWeight={700} fontSize={8.5 * unit}>
            {priority}
          </text>
        </g>
      )}
    </g>
  );
}

/* ---------------- Grupo de objetivos solapados ---------------- */

interface ClusterMarkerProps {
  point: GeoPoint;
  ids: string[];
  highlighted: boolean;
  onClick: () => void;
}

export function ClusterMarker({ point, ids, highlighted, onClick }: ClusterMarkerProps) {
  const { projection, unit } = useMap();
  const { x, y } = projection.toXY(point);
  const r = 14 * unit;
  const label = `${ids.length} targets close together: ${ids.join(', ')}. Tap to zoom in.`;
  return (
    <g transform={`translate(${x} ${y})`} onClick={stop(onClick)} style={{ cursor: 'zoom-in' }} role="button" aria-label={label}>
      <title>{label}</title>
      <circle r={r * 1.45} fill={highlighted ? COLORS.primary : COLORS.muted} fillOpacity={0.2} />
      <circle r={r} fill={COLORS.surface} stroke={highlighted ? COLORS.primary : COLORS.muted} strokeWidth={2} vectorEffect="non-scaling-stroke" />
      <text y={4 * unit} textAnchor="middle" fill={COLORS.text} fontFamily="Space Grotesk" fontWeight={700} fontSize={11 * unit}>
        {ids.length}
      </text>
    </g>
  );
}

/* ---------------- Estacionamientos ---------------- */

interface ParkingMarkerProps {
  point: GeoPoint;
  label: string;
  active?: boolean;
  planned?: boolean;
  onClick?: () => void;
}

export function ParkingMarker({ point, label, active, planned, onClick }: ParkingMarkerProps) {
  const { projection, unit } = useMap();
  const { x, y } = projection.toXY(point);
  const r = 11 * unit;
  return (
    <g transform={`translate(${x} ${y})`} onClick={stop(onClick)} style={{ cursor: onClick ? 'pointer' : 'default' }} role="button" aria-label={`Parking ${label}`}>
      <title>{`Rover parking ${label}${planned ? ' · walk planned' : ''}`}</title>
      {active && <circle r={r * 1.9} fill={COLORS.accent} fillOpacity={0.2} />}
      <rect x={-r} y={-r} width={r * 2} height={r * 2} rx={4 * unit} fill={active ? COLORS.accent : COLORS.surface} stroke={COLORS.accent} strokeWidth={2} vectorEffect="non-scaling-stroke" />
      <text y={3.5 * unit} textAnchor="middle" fill={active ? '#120D0D' : COLORS.accent} fontFamily="Space Grotesk" fontWeight={700} fontSize={9.5 * unit}>
        {label}
      </text>
      {planned && <circle cx={r} cy={-r} r={4.5 * unit} fill={COLORS.success} stroke="#120D0D" strokeWidth={1} vectorEffect="non-scaling-stroke" />}
    </g>
  );
}

/* ---------------- Base ---------------- */

export function BaseMarker({ point, label, pending }: { point: GeoPoint; label: string; pending?: boolean }) {
  const { projection, unit } = useMap();
  const { x, y } = projection.toXY(point);
  const w = 76 * unit;
  return (
    <g transform={`translate(${x} ${y})`} pointerEvents="none">
      <circle r={16 * unit} fill={COLORS.primary} fillOpacity={0.25}>
        {pending && <animate attributeName="r" values={`${12 * unit};${22 * unit};${12 * unit}`} dur="1.6s" repeatCount="indefinite" />}
      </circle>
      <circle r={7 * unit} fill={COLORS.text} stroke={COLORS.primary} strokeWidth={3} vectorEffect="non-scaling-stroke" />
      <rect x={-w / 2} y={14 * unit} width={w} height={18 * unit} rx={4 * unit} fill={COLORS.surface} stroke={COLORS.primary} vectorEffect="non-scaling-stroke" />
      <text y={26 * unit} textAnchor="middle" fill={COLORS.text} fontFamily="Space Grotesk" fontWeight={700} fontSize={9.5 * unit}>
        {label}
      </text>
    </g>
  );
}

/* ---------------- Zonas de peligro ---------------- */

interface HazardCircleProps {
  center: GeoPoint;
  radius: number;
  blocked?: boolean; // bloqueo por contingencia (vs. zona marcada por el usuario)
  onClick?: () => void;
}

export function HazardCircle({ center, radius, blocked, onClick }: HazardCircleProps) {
  const { projection, unit } = useMap();
  const { x, y } = projection.toXY(center);
  return (
    <g onClick={stop(onClick)} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      <title>{blocked ? 'Blocked path' : 'Danger zone'}</title>
      <circle cx={x} cy={y} r={radius} fill={COLORS.error} fillOpacity={0.22} stroke={COLORS.error} strokeWidth={1.5} strokeDasharray="6 4" vectorEffect="non-scaling-stroke" />
      {/* Símbolo en lugar de palabra: se entiende igual en cualquier idioma */}
      {radius / unit > 14 && (
        <text x={x} y={y + 5 * unit} textAnchor="middle" fill={COLORS.text} fontSize={14 * unit} pointerEvents="none">
          {blocked ? '⛔' : '⚠'}
        </text>
      )}
    </g>
  );
}

/* ---------------- Posición simulada ---------------- */

export function PositionMarker({ point, heading, mode }: { point: GeoPoint; heading: number; mode: 'rover' | 'eva' }) {
  const { projection, unit } = useMap();
  const { x, y } = projection.toXY(point);
  const color = mode === 'rover' ? COLORS.primary : COLORS.accent;
  return (
    <g transform={`translate(${x} ${y})`} pointerEvents="none">
      <circle r={14 * unit} fill={color} fillOpacity={0.25}>
        <animate attributeName="r" values={`${12 * unit};${24 * unit};${12 * unit}`} dur="1.8s" repeatCount="indefinite" />
        <animate attributeName="fill-opacity" values="0.35;0;0.35" dur="1.8s" repeatCount="indefinite" />
      </circle>
      <g transform={`rotate(${heading})`}>
        <path d={`M 0 ${-15 * unit} L ${7 * unit} ${2 * unit} L 0 ${-2 * unit} L ${-7 * unit} ${2 * unit} Z`} fill={COLORS.text} />
      </g>
      <circle r={6 * unit} fill={COLORS.text} stroke={color} strokeWidth={3} vectorEffect="non-scaling-stroke" />
    </g>
  );
}

/* ---------------- Vista previa del cursor ---------------- */

export function CursorRing({ point, radius }: { point: GeoPoint; radius: number }) {
  const { projection } = useMap();
  const { x, y } = projection.toXY(point);
  return (
    <circle cx={x} cy={y} r={radius} fill="none" stroke={COLORS.error} strokeWidth={1.5} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" pointerEvents="none" />
  );
}
