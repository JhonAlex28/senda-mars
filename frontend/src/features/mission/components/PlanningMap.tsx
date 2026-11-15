import { useMemo, useState } from 'react';
import {
  BaseMarker,
  Clustered,
  CursorRing,
  HazardCircle,
  MapCanvas,
  MapLegend,
  ParkingMarker,
  TargetMarker,
  type Projection,
} from '@/features/map';
import { terrainRasters, useLayers } from '@/features/layers';
import { PROFILE_META, distinctProfiles } from '@/features/route-planning';
import { TargetCard, type Target } from '@/features/targets';
import { TerrainReadout, useTerrain, type TerrainLayer } from '@/features/terrain';
import { bboxAround } from '@/shared/lib/geo';
import type { BBox, GeoPoint } from '@/shared/types/geo';
import { Icon } from '@/shared/ui/Icon';
import { Phrase } from '@/shared/ui/Text';
import { activeParking } from '../state/selectors';
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
  const walking = state.phase === 'walk';
  const parking = activeParking(state);

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
    else dispatch({ type: 'focusTarget', id: null });
  };

  return (
    <main className="relative flex min-h-0 flex-col overflow-hidden rounded-lg border border-outline bg-surface">
      <div className="relative min-h-0 flex-1">
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
            </>
          }
        >
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
      </div>
      <TerrainReadout grid={evaTerrain?.grid ?? site.grid} point={hover} />
    </main>
  );
}

function Notice({ text, onClose }: { text: string; onClose: () => void }) {
  return (
    <div className="absolute bottom-[60px] left-1/2 z-30 flex -translate-x-1/2 animate-fade-up items-center gap-sm rounded-lg border border-warning/60 bg-surface-container/95 px-md py-sm font-body text-body-sm shadow-xl">
      <Icon name="info" className="text-[18px] text-warning" />
      <Phrase>{text}</Phrase>
      <button type="button" onClick={onClose} aria-label="Dismiss" className="text-on-surface-variant hover:text-on-surface">
        <Icon name="close" className="text-[16px]" />
      </button>
    </div>
  );
}
