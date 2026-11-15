import { useCallback, useMemo, type ReactNode } from 'react';
import { WeatherStrip, useReadiness, type Readiness } from '@/features/environment';
import { ExecutionView, buildItinerary } from '@/features/field-simulation';
import { LayersPanel } from '@/features/layers';
import { CrewSwitcher, PlanCalendarCard } from '@/features/mission-log';
import { createProjection, type Projection } from '@/features/map';
import {
  BaseCard,
  ErrorNote,
  EvaPanel,
  GoalsCard,
  LaunchCard,
  MarsWeatherCard,
  MissionHeader,
  PlanningMap,
  TraversePanel,
  allEvasPlanned,
  selectedEva,
  selectedTraverse,
  useMission,
} from '@/features/mission';
import { useTerrain, type TerrainLayer } from '@/features/terrain';
import { Icon } from '@/shared/ui/Icon';
import { SuppliesCard } from '@/shared/ui/SuppliesCard';

const SITE_CELL_M = 10;

/** Página principal de la misión: Plan y Walk (planificación) y Go (ejecución simulada). */
export function MissionControlPage() {
  const { state, targetsError } = useMission();
  const { layer: site, error: terrainError } = useTerrain(SITE_CELL_M);
  const { data: readiness } = useReadiness();
  const projection = useMemo(() => (site ? createProjection(site.grid.bbox) : null), [site]);
  const error = targetsError ?? terrainError;

  return (
    <div className="flex h-full min-h-[720px] flex-col overflow-hidden">
      <MissionHeader extra={<CrewSwitcher />} />
      {error && (
        <div className="p-md">
          <ErrorNote message={`Cannot reach the SENDA server (${error.message}). Is the backend running on port 8000?`} />
        </div>
      )}
      {!site || !projection ? (
        <Loading />
      ) : state.phase === 'go' ? (
        <GoView projection={projection} site={site} readiness={readiness} />
      ) : (
        <PlanView projection={projection} site={site} readiness={readiness} />
      )}
    </div>
  );
}

interface ViewProps {
  projection: Projection;
  site: TerrainLayer;
  readiness: Readiness | null;
}

function PlanView({ projection, site, readiness }: ViewProps) {
  const { state } = useMission();
  const ready = allEvasPlanned(state);
  const route = selectedTraverse(state);

  return (
    <>
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-md p-md lg:grid-cols-[320px_1fr_320px]">
        <aside className="scroll-thin flex min-h-0 flex-col gap-md overflow-y-auto">
          <LayersPanel />
          <MarsWeatherCard readiness={readiness} />
          <SuppliesCard pct={route?.resource.remaining_pct ?? null} hint="Battery at the end of the route" />
        </aside>
        <PlanningMap projection={projection} site={site} />
        <aside className="scroll-thin flex min-h-0 flex-col gap-sm overflow-y-auto pr-xs">
          <PlanCalendarCard />
          <BaseCard />
          <GoalsCard />
          {state.phase === 'walk' ? <EvaPanel /> : <TraversePanel />}
          {ready && <LaunchCard readiness={readiness} />}
        </aside>
      </div>
    </>
  );
}

function GoView({ projection, site, readiness }: ViewProps) {
  const { state, dispatch, targets, addProcedureRecord } = useMission();
  const onProcedureCompleted = useCallback((targetId: string) => addProcedureRecord(targetId), [addProcedureRecord]);
  // El itinerario se fija al entrar en Go: la simulación trabaja sobre su propia copia
  const legs = useMemo(() => {
    const rover = selectedTraverse(state);
    if (!rover || !state.traverse) return [];
    const walks = Object.fromEntries(state.traverse.parkings.map((p) => [p.id, selectedEva(state, p.id)]));
    return buildItinerary(rover, walks);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!state.base || !state.traverse || legs.length === 0) return <Loading />;
  return (
    <ExecutionView
      legs={legs}
      base={state.base}
      hazards={state.hazards}
      parkings={state.traverse.parkings}
      targets={targets}
      onProcedureCompleted={onProcedureCompleted}
      projection={projection}
      site={site}
      vehicleId={state.vehicleId}
      crew={state.crew}
      crewStatusOpen={state.crewStatusOpen}
      onCloseCrewStatus={() => dispatch({ type: 'setCrewStatusOpen', open: false })}
      renderFooter={(supplies: ReactNode) => <WeatherStrip readiness={readiness}>{supplies}</WeatherStrip>}
      // Al cerrar el resumen la interfaz queda limpia para otra misión (base, tripulación e historial se conservan)
      onReplan={() => dispatch({ type: 'finishMission' })}
      onExit={() => dispatch({ type: 'finishMission', toGlobe: true })}
    />
  );
}

function Loading() {
  return (
    <div className="flex flex-1 items-center justify-center gap-sm font-label text-label-lg uppercase text-on-surface-variant">
      <Icon name="progress_activity" className="animate-spin text-[22px] text-accent" />
      Loading terrain…
    </div>
  );
}
