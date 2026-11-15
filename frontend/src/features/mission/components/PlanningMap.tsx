import { useMemo, useState } from 'react';
import {
  BaseMarker,
  Clustered,
  CursorRing,
  HazardCircle,
  MapCanvas,
  MapLegend,
  ParkingMarker,
  RouteLine,
  TargetMarker,
  type Projection,
} from '@/features/map';
import { terrainRasters, useLayers } from '@/features/layers';
import { PROFILE_META, distinctProfiles, routesApi } from '@/features/route-planning';
import { TargetCard, type Target } from '@/features/targets';
import { Terrain3DView, TerrainReadout, useTerrain, type TerrainLayer } from '@/features/terrain';
import { bboxAround } from '@/shared/lib/geo';
import type { BBox, GeoPoint } from '@/shared/types/geo';
import { Icon } from '@/shared/ui/Icon';
import { Phrase } from '@/shared/ui/Text';
import { activeParking, selectedEva, selectedTraverse } from '../state/selectors';
import { ROVER_VEHICLES } from '../state/vehicles';
import { useMission } from '../state/MissionContext';
import { MapToolbar } from './MapToolbar';
import { PlanRouteLayers } from './PlanRouteLayers';
import { StepBanner } from './StepBanner';

const HAZARD_RADIUS_M = { plan: 60, walk: 12 } as const;
const EVA_DETAIL_CELL_M = 3;
const EVA_VIEW_MARGIN_M = 90;

interface PlanningMapProps {
  projection: Projection;
  site: TerrainLayer;
}

/** Mapa de las fases Plan y Walk: objetivos, base, peligros, rutas del rover y caminatas. */
export function PlanningMap({ projection, site }: PlanningMapProps) {
  const { state, dispatch, targets, targetById } = useMission();
  const { layers, shown } = useLayers();
  const [hover, setHover] = useState<GeoPoint | null>(null);
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('2d');
  const [customAStar, setCustomAStar] = useState<{ points: GeoPoint[]; distanceM: number; maxSlope: number } | null>(null);
  const [scoutError, setScoutError] = useState<string | null>(null);
  const walking = state.phase === 'walk';
  const parking = activeParking(state);
  const activeRoverRoute = selectedTraverse(state);
  const evaRoutesList = (state.traverse?.parkings ?? [])
    .map((p) => selectedEva(state, p.id))
    .filter((r): r is NonNullable<typeof r> => !!r);

  // Vista detallada (celdas de 3 m) alrededor del estacionamiento activo durante la fase Walk
  const evaBox = useMemo<BBox | null>(() => {
    if (!walking || !parking) return null;
    const zone = parking.target_ids.map((id) => targetById.get(id)).filter((t): t is Target => !!t);
    return bboxAround([parking, ...zone], EVA_VIEW_MARGIN_M);
  }, [walking, parking, targetById]);
  const { layer: evaTerrain } = useTerrain(EVA_DETAIL_CELL_M, evaBox);

  const hazardRadius = HAZARD_RADIUS_M[walking ? 'walk' : 'plan'];
  const scienceTargets = useMemo(() => targets.filter((t) => !t.is_base), [targets]);
  const focused = state.focusedTargetId ? targetById.get(state.focusedTargetId) : undefined;
  const zoneTargets = new Set(walking ? parking?.target_ids : undefined);
  // Leyenda de las rutas que se ven: las caminatas del estacionamiento activo en Walk, las del rover en Plan
  const evaPlan = walking && parking ? state.evaPlans[parking.id] : undefined;
  const legendRoutes = evaPlan ? { routes: evaPlan.routes, profile: evaPlan.profile } : state.traverse && { routes: state.traverse.routes, profile: state.traverseProfile };
  const legend = legendRoutes ? distinctProfiles(legendRoutes.routes, legendRoutes.profile).map((p) => ({ label: PROFILE_META[p].label, swatch: PROFILE_META[p].swatch })) : [];

  const onMapClick = (p: GeoPoint) => {
    if (state.tool === 'base') dispatch({ type: 'moveBase', point: p });
    else if (state.tool === 'hazard') dispatch({ type: 'addHazard', hazard: { ...p, radius_m: hazardRadius } });
    else if (state.tool === 'astar' && state.base) void scout(state.base, p);
    else dispatch({ type: 'focusTarget', id: null });
  };

  // Vista previa de un camino seguro desde la base: lo calcula el planificador del backend
  // (mismo A*, terreno y reglas que las rutas reales), no una copia en el navegador.
  const scout = async (base: GeoPoint, to: GeoPoint) => {
    setScoutError(null);
    try {
      const [route] = await routesApi.path(
        'rover',
        [
          { ...base, kind: 'base', ref_id: 'base' },
          { ...to, kind: 'waypoint', ref_id: '' },
        ],
        { hazards: state.hazards },
        ['safe'],
      );
      setCustomAStar(route ? { points: route.points, distanceM: route.distance_m, maxSlope: route.max_slope_deg } : null);
    } catch (e) {
      setCustomAStar(null);
      setScoutError(e instanceof Error ? e.message : 'No safe path to that point.');
    }
  };

  return (
    <main className="relative flex min-h-0 flex-col overflow-hidden rounded-lg border border-outline bg-surface">
      <div className="relative min-h-0 flex-1">
        {/* 2D GIS / 3D DEM View Mode Toggle */}
        <div className="absolute bottom-12 left-1/2 z-30 flex -translate-x-1/2 items-center rounded-full border border-outline bg-surface-container/95 p-0.5 font-mono text-mono-sm shadow-lg backdrop-blur-sm">
          <button
            type="button"
            onClick={() => setViewMode('2d')}
            className={`rounded-full px-md py-1 transition-colors ${
              viewMode === '2d' ? 'bg-primary text-on-primary font-bold' : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            2D GIS
          </button>
          <button
            type="button"
            onClick={() => setViewMode('3d')}
            className={`rounded-full px-md py-1 transition-colors ${
              viewMode === '3d' ? 'bg-primary text-on-primary font-bold' : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            3D DEM
          </button>
        </div>

        {viewMode === '3d' ? (
          <Terrain3DView
            grid={evaTerrain?.grid ?? site.grid}
            base={state.base}
            targets={targets}
            roverRoute={activeRoverRoute ?? null}
            evaRoutes={evaRoutesList}
            parkings={state.traverse?.parkings ?? []}
            vehicleLabel={ROVER_VEHICLES[state.vehicleId].shortName}
          />
        ) : (
          <MapCanvas
          projection={projection}
          rasters={terrainRasters([site, evaTerrain], layers)}
          focus={evaBox ?? site.grid.bbox}
          cursor={state.tool === 'select' ? 'grab' : 'crosshair'}
          onMapClick={onMapClick}
          onPointerMoveGeo={setHover}
          overlay={
            <>
              <StepBanner />
              <MapToolbar />
              <MapLegend items={shown('routes') ? legend : []} />
              {focused && (
                <div className="absolute right-md top-[72px] z-30">
                  <TargetCard
                    key={focused.id}
                    target={focused}
                    priority={state.goals.includes(focused.id) ? state.goals.indexOf(focused.id) + 1 : null}
                    onToggle={() => dispatch({ type: 'toggleGoal', id: focused.id })}
                    onClose={() => dispatch({ type: 'focusTarget', id: null })}
                  />
                </div>
              )}
              {state.notice && <Notice text={state.notice} onClose={() => dispatch({ type: 'dismissNotice' })} />}
              {customAStar && (
                <div className="absolute bottom-md right-md z-30 flex items-center gap-sm rounded-md border border-success/60 bg-surface-container/95 px-md py-xs font-mono text-mono-sm shadow-lg">
                  <span className="text-success">
                    Scout path: {Math.round(customAStar.distanceM)} m · Max slope {customAStar.maxSlope.toFixed(1)}°
                  </span>
                  <button
                    type="button"
                    onClick={() => setCustomAStar(null)}
                    className="text-on-surface-variant hover:text-on-surface"
                  >
                    ✕
                  </button>
                </div>
              )}
              {scoutError && (
                <div className="absolute bottom-md right-md z-30 flex items-center gap-sm rounded-md border border-error/60 bg-surface-container/95 px-md py-xs font-mono text-mono-sm shadow-lg">
                  <span className="text-error">Scout path: {scoutError}</span>
                  <button type="button" onClick={() => setScoutError(null)} className="text-on-surface-variant hover:text-on-surface">
                    ✕
                  </button>
                </div>
              )}
            </>
          }
        >
          {customAStar && <RouteLine points={customAStar.points} color="#7CD992" width={3} dotted />}
          {shown('hazards') &&
            state.hazards.map((h, i) => (
            <HazardCircle
              key={i}
              center={h}
              radius={h.radius_m}
              onClick={state.tool === 'hazard' ? () => dispatch({ type: 'removeHazard', index: i }) : undefined}
            />
          ))}

          {shown('routes') && <PlanRouteLayers />}

          {shown('targets') && (
          <Clustered
            items={scienceTargets}
            highlight={(t) => state.goals.includes(t.id)}
            renderItem={(t) => {
              const priority = state.goals.indexOf(t.id);
              return (
                <TargetMarker
                  point={t}
                  id={t.id}
                  name={t.name}
                  state={priority >= 0 ? 'goal' : 'idle'}
                  priority={priority >= 0 ? priority + 1 : undefined}
                  focused={state.focusedTargetId === t.id}
                  dimmed={walking && !zoneTargets.has(t.id)}
                  onClick={() => dispatch({ type: 'focusTarget', id: t.id })}
                />
              );
            }}
          />
          )}

          {shown('routes') &&
            state.traverse?.parkings.map((p) => (
            <ParkingMarker
              key={p.id}
              point={p}
              label={p.id}
              active={p.id === state.activeParkingId}
              planned={!!state.evaPlans[p.id]}
              onClick={() => dispatch({ type: 'selectParking', id: p.id })}
            />
          ))}

          {state.base && <BaseMarker point={state.base} label="BASE ALPHA" />}
          {state.tool === 'hazard' && hover && <CursorRing point={hover} radius={hazardRadius} />}
        </MapCanvas>
        )}
      </div>
      <TerrainReadout grid={evaTerrain?.grid ?? site.grid} point={hover} />
    </main>
  );
}

function Notice({ text, onClose }: { text: string; onClose: () => void }) {
  return (
    <div className="absolute bottom-[92px] left-1/2 z-30 flex -translate-x-1/2 animate-fade-up items-center gap-sm rounded-lg border border-warning/60 bg-surface-container/95 px-md py-sm font-body text-body-sm shadow-xl">
      <Icon name="info" className="text-[18px] text-warning" />
      <Phrase>{text}</Phrase>
      <button type="button" onClick={onClose} aria-label="Dismiss" className="text-on-surface-variant hover:text-on-surface">
        <Icon name="close" className="text-[16px]" />
      </button>
    </div>
  );
}
