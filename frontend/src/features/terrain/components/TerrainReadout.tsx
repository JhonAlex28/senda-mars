import { formatLat, formatLon } from '@/shared/lib/geo';
import type { GeoPoint } from '@/shared/types/geo';
import { Live, Phrase } from '@/shared/ui/Text';
import { CAUTION_SLOPE_DEG, DANGER_SLOPE_DEG } from '../lib/renderTerrain';
import { sampleTerrain } from '../lib/sample';
import type { TerrainGrid } from '../types';

function groundWord(slope: number): { word: string; color: string } {
  if (slope > DANGER_SLOPE_DEG) return { word: 'Too steep', color: 'text-error' };
  if (slope > CAUTION_SLOPE_DEG) return { word: 'Be careful', color: 'text-warning' };
  return { word: 'Easy', color: 'text-success' };
}

/** Franja inferior del mapa: coordenadas, elevación y pendiente bajo el cursor. */
export function TerrainReadout({ grid, point }: { grid: TerrainGrid | null; point: GeoPoint | null }) {
  const sample = grid && point ? sampleTerrain(grid, point) : null;
  const ground = sample ? groundWord(sample.slope) : null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-md gap-y-xs border-t border-outline-variant bg-surface-container px-md py-xs font-mono text-mono-sm tabular-nums text-on-surface-variant">
      <div className="flex flex-wrap items-center gap-x-md">
        <Live>
          LAT <strong className="text-on-surface">{point ? formatLat(point.lat) : '—'}</strong>
        </Live>
        <Live>
          LON <strong className="text-on-surface">{point ? formatLon(point.lon) : '—'}</strong>
        </Live>
        <span>
          Height <Live className="font-bold text-on-surface">{sample ? `${Math.round(sample.elevation).toLocaleString('en-US')} m` : '—'}</Live>
        </span>
        <span>
          Slope <Live className="font-bold text-on-surface">{sample ? `${sample.slope.toFixed(1)}°` : '—'}</Live>
        </span>
        <span>
          Ground <strong className={ground?.color ?? 'text-on-surface'}>{ground ? <Phrase>{ground.word}</Phrase> : '—'}</strong>
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-x-sm">
        <span className="flex items-center gap-xs" title="Be careful on this ground">
          <i className="h-2 w-3 bg-warning/70" />
          <Live>&gt;{CAUTION_SLOPE_DEG}°</Live>
        </span>
        <span className="flex items-center gap-xs" title="Too steep to cross">
          <i className="h-2 w-3 bg-error/80" />
          <Live>&gt;{DANGER_SLOPE_DEG}°</Live>
        </span>
        <span className="text-warning" title="The elevation map cannot show rocks smaller than 2 m.">
          ⚠ Small rocks are not on the map
        </span>
      </div>
    </div>
  );
}
