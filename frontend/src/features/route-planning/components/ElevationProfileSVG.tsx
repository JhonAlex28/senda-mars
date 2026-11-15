import type { RoutePlan } from '../types';

interface ElevationProfileSVGProps {
  route: RoutePlan;
}

/** Elevation profile SVG with Rover (blue) / Foot EVA (green) coloring and Hub/Target markers. */
export function ElevationProfileSVG({ route }: ElevationProfileSVGProps) {
  const pts = route.points;
  if (pts.length < 2) return null;

  const elevs = pts.map((p) => p.elevation_m);
  const minZ = Math.min(...elevs) - 4;
  const maxZ = Math.max(...elevs) + 4;
  const spanZ = Math.max(1, maxZ - minZ);

  const w = 310;
  const h = 76;
  const padL = 38;
  const padR = 10;
  const padT = 12;
  const padB = 18;
  const pw = w - padL - padR;
  const ph = h - padT - padB;

  const strokeColor = route.mode === 'rover' ? '#0077CC' : '#7CD992';
  const polyPts = pts.map((p, i) => {
    const x = padL + (i / (pts.length - 1)) * pw;
    const y = padT + (1 - (p.elevation_m - minZ) / spanZ) * ph;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const area = [`${padL},${padT + ph}`, ...polyPts, `${padL + pw},${padT + ph}`].join(' ');
  const climbM = Math.max(0, Math.round(Math.max(...elevs) - elevs[0]));

  return (
    <div className="rounded border border-outline-variant bg-surface p-xs">
      <div className="mb-1 flex items-center justify-between font-mono text-[10px] text-on-surface-variant">
        <span>ELEVATION PROFILE ({route.mode.toUpperCase()} · +{climbM} m)</span>
        <span style={{ color: strokeColor }} className="font-bold">
          {(route.distance_m / 1000).toFixed(2)} km
        </span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="block h-[76px] w-full">
        <line x1={padL} y1={padT} x2={padL + pw} y2={padT} stroke="#1F2A37" strokeDasharray="2,2" />
        <line x1={padL} y1={padT + ph} x2={padL + pw} y2={padT + ph} stroke="#1F2A37" />
        <text x={padL - 4} y={padT + 4} textAnchor="end" fill="#8B98A5" fontSize="8" fontFamily="monospace">
          {Math.round(maxZ)}m
        </text>
        <text x={padL - 4} y={padT + ph} textAnchor="end" fill="#8B98A5" fontSize="8" fontFamily="monospace">
          {Math.round(minZ)}m
        </text>
        <polygon points={area} fill={strokeColor} opacity="0.18" />
        <polyline
          points={polyPts.join(' ')}
          fill="none"
          stroke={strokeColor}
          strokeWidth="2.2"
          strokeDasharray={route.mode === 'eva' ? '4,2' : undefined}
        />
        {route.stops
          .filter((s) => s.kind === 'parking' || s.kind === 'target')
          .map((stop, idx) => {
            const x = padL + (stop.point_index / Math.max(1, pts.length - 1)) * pw;
            const z = pts[stop.point_index]?.elevation_m ?? minZ;
            const y = padT + (1 - (z - minZ) / spanZ) * ph;
            const isHub = stop.kind === 'parking';
            return (
              <g key={`${stop.ref_id}-${idx}`}>
                <line x1={x} y1={padT} x2={x} y2={padT + ph} stroke={isHub ? '#4FC3F7' : '#E8B04B'} strokeDasharray="2,2" opacity="0.65" />
                <circle cx={x} cy={y} r="3" fill={isHub ? '#0077CC' : '#E8B04B'} stroke="#FFF" strokeWidth="0.9" />
              </g>
            );
          })}
        <text x={padL} y={h - 3} fill="#8B98A5" fontSize="8" fontFamily="monospace">
          Start
        </text>
        <text x={padL + pw} y={h - 3} textAnchor="end" fill="#8B98A5" fontSize="8" fontFamily="monospace">
          {Math.round(route.distance_m)} m
        </text>
      </svg>
    </div>
  );
}
