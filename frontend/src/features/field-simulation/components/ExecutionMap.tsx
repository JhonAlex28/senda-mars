import { useMemo, useState } from 'react';
import {
  BaseMarker,
  Clustered,
  HazardCircle,
  MapCanvas,
  MapLegend,
  ParkingMarker,
  PositionMarker,
  RouteLine,
  TargetMarker,
  type Projection,
  type TargetState,
} from '@/features/map';
import { terrainRasters, useLayers } from '@/features/layers';
import { ROVER_VEHICLES, type RoverVehicleId } from '@/features/mission/state/vehicles';
import type { Hazard, Parking } from '@/features/route-planning';
import type { Target } from '@/features/targets';
import { Terrain3DView, TerrainReadout, useTerrain, type TerrainLayer } from '@/features/terrain';
import { formatDistance, formatMinutes } from '@/shared/lib/format';
import { bboxAround } from '@/shared/lib/geo';
import type { GeoPoint } from '@/shared/types/geo';
import { Icon } from '@/shared/ui/Icon';
import { Live, Phrase } from '@/shared/ui/Text';
import type { Simulation } from '../hooks/useSimulation';
import { legRemaining } from '../lib/itinerary';
import { MODE_ICON, stopLabel } from '../lib/labels';
import { ScienceTaskCard } from './ScienceTaskCard';

const VIEW_MARGIN_M = { rover: 160, eva: 45 } as const;
const EVA_DETAIL_CELL_M = 3;

interface ExecutionMapProps {
  projection: Projection;
  site: TerrainLayer;
  sim: Simulation;
  targets: Target[];
  parkings: Parking[];
  base: GeoPoint;
  hazards: Hazard[];
  vehicleId?: RoverVehicleId;
}

/** Mapa del modo Go: posición simulada, tramo actual y lo que queda por recorrer. */
export function ExecutionMap({ projection, site, sim, targets, parkings, base, hazards, vehicleId = 'SEV_PRESSURIZED' }: ExecutionMapProps) {
  const { state, leg, here, dispatch } = sim;
  const [hover, setHover] = useState<GeoPoint | null>(null);
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('2d');
  const { layers } = useLayers();
  const targetById = useMemo(() => new Map(targets.map((t) => [t.id, t])), [targets]);
  const name = (id: string) => targetById.get(id)?.name;

  // Encuadre por tramo: amplio al conducir, detallado (con terreno de 3 m) al caminar
  const focus = useMemo(() => bboxAround(leg.points, VIEW_MARGIN_M[leg.mode]), [leg]);
  const { layer: detail } = useTerrain(EVA_DETAIL_CELL_M, leg.mode === 'eva' ? focus : null);

  const legTargets = new Set(state.legs.flatMap((l) => l.stops.filter((s) => s.kind === 'target').map((s) => s.refId)));
  const targetState = (id: string): TargetState => {
    if (state.completed.includes(id)) return 'done';
    if (state.skipped.includes(id)) return 'skipped';
    return 'goal';
  };
  const travelled = leg.points.filter((p) => p.t <= state.t);
  const ahead = leg.points.filter((p) => p.t >= state.t);
  const next = leg.stops[state.nextStop];
  const remaining = legRemaining(leg, state.t, state.nextStop);
  const arrivedTarget = state.arrived?.kind === 'target' ? state.arrived : null;

  return (
    <main className="relative flex min-h-0 flex-col overflow-hidden rounded-lg border border-outline bg-surface">
      <div className="absolute right-md top-md z-30 flex items-center gap-xs rounded-md border border-outline bg-surface-container/95 p-0.5 font-label text-label-sm shadow-lg backdrop-blur-sm">
        <button
          type="button"
          onClick={() => setViewMode('2d')}
          className={`rounded px-sm py-1 transition ${
            viewMode === '2d' ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          2D GIS
        </button>
        <button
          type="button"
          onClick={() => setViewMode('3d')}
          className={`rounded px-sm py-1 transition ${
            viewMode === '3d' ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          3D DEM
        </button>
      </div>

      <div className="relative min-h-0 flex-1">
        {viewMode === '3d' ? (
          <Terrain3DView
            grid={site.grid}
            base={base}
            targets={targets}
            roverRoute={(() => {
              const pts = state.legs.filter((l) => l.mode === 'rover').flatMap((l) => l.points);
              return pts.length > 0 ? { points: pts } : null;
            })()}
            evaRoutes={state.legs
              .filter((l) => l.mode === 'eva')
              .map((l) => ({ points: l.points }))}
            parkings={parkings}
            vehicleLabel={ROVER_VEHICLES[vehicleId].shortName}
            livePosition={{ lon: here.point.lon, lat: here.point.lat, heading: here.heading, mode: leg.mode }}
          />
        ) : (
        <MapCanvas
          projection={projection}
          rasters={terrainRasters([site, detail], layers)}
          focus={focus}
          onPointerMoveGeo={setHover}
          overlay={
            <>
              <div className="pointer-events-none absolute left-md top-md z-20 flex max-w-[min(420px,calc(100%-7rem))] items-center gap-sm rounded-lg border border-accent/60 bg-surface-container/95 px-md py-sm shadow-xl">
                <Icon name={MODE_ICON[leg.mode]} className="shrink-0 text-[26px] text-accent" />
                <div className="min-w-0">
                  <Phrase className="block font-label text-label-sm uppercase text-on-surface-variant">
                    {leg.mode === 'rover' ? 'Driving to' : 'Walking to'}
                  </Phrase>
                  <Phrase className="block break-words font-headline text-title-md">{next ? stopLabel(next, name) : 'End of this part'}</Phrase>
                  <p className="font-mono text-mono-sm text-on-surface-variant">
                    <Live>
                      {formatDistance(remaining.distance)} · {formatMinutes(remaining.minutes)} · {Math.round(here.heading)}°
                    </Live>
                  </p>
                </div>
              </div>
              <MapLegend
                items={[
                  { label: 'Already traveled', swatch: 'bg-on-surface-variant' },
                  { label: 'Next part', swatch: leg.mode === 'rover' ? 'bg-primary' : 'bg-accent' },
                  { label: 'Later parts', swatch: 'bg-outline' },
                ]}
              />
              {!state.running && !state.arrived && !state.finished && (
                <div className="pointer-events-none absolute left-1/2 top-md z-20 -translate-x-1/2 rounded-full border border-outline bg-surface-container/95 px-md py-xs font-label text-label-sm uppercase text-warning">
                  Paused
                </div>
              )}
              {arrivedTarget && (
                <div className="absolute bottom-[56px] left-1/2 z-30 -translate-x-1/2">
                  <ScienceTaskCard
                    key={arrivedTarget.refId}
                    target={targetById.get(arrivedTarget.refId)}
                    targetId={arrivedTarget.refId}
                    task={state.task}
                    onBegin={() => dispatch({ type: 'beginTask' })}
                    onComplete={() => dispatch({ type: 'completeTask' })}
                    onSkip={() => dispatch({ type: 'skipStop' })}
                  />
                </div>
              )}
            </>
          }
        >
          {[...hazards, ...state.extraHazards].map((h, i) => (
            <HazardCircle key={i} center={h} radius={h.radius_m} blocked={i >= hazards.length} />
          ))}

          {state.legs.slice(state.legIndex + 1).map((l) => (
            <RouteLine key={l.id} points={l.points} color="#6b5450" dotted={l.mode === 'eva'} width={2} opacity={0.8} />
          ))}
          {state.legs.slice(0, state.legIndex).map((l) => (
            <RouteLine key={l.id} points={l.points} color="#B8A9A7" dotted={l.mode === 'eva'} width={3} opacity={0.6} />
          ))}
          {state.trail.map((points, i) => (
            <RouteLine key={`trail-${i}`} points={points} color="#B8A9A7" width={3} opacity={0.6} />
          ))}
          {travelled.length > 1 && <RouteLine points={[...travelled, here.point]} color="#B8A9A7" width={3} opacity={0.7} dotted={leg.mode === 'eva'} />}
          {ahead.length > 0 && (
            <RouteLine points={[here.point, ...ahead]} color={leg.mode === 'rover' ? '#D9532B' : '#F0875A'} width={4} halo dotted={leg.mode === 'eva'} />
          )}

          <Clustered
            items={targets.filter((t) => legTargets.has(t.id))}
            highlight={(t) => targetState(t.id) === 'goal'}
            renderItem={(t) => (
              <TargetMarker
                point={t}
                id={t.id}
                name={t.name}
                state={targetState(t.id)}
                focused={next?.kind === 'target' && next.refId === t.id}
              />
            )}
          />
          {parkings.map((p) => (
            <ParkingMarker key={p.id} point={p} label={p.id} active={leg.parkingId === p.id} planned={state.visited.includes(p.id)} />
          ))}
          <BaseMarker point={base} label="BASE ALPHA" />
          <PositionMarker point={here.point} heading={here.heading} mode={leg.mode} />
        </MapCanvas>
        )}
      </div>
      <TerrainReadout grid={detail?.grid ?? site.grid} point={hover ?? here.point} />
    </main>
  );
}
