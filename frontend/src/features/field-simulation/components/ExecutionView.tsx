import { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react';
import type { Projection } from '@/features/map';
import type { Hazard, Parking } from '@/features/route-planning';
import type { Target } from '@/features/targets';
import type { TerrainLayer } from '@/features/terrain';
import type { GeoPoint } from '@/shared/types/geo';
import { SuppliesCard } from '@/shared/ui/SuppliesCard';
import { useSimulation } from '../hooks/useSimulation';
import type { Leg } from '../lib/itinerary';
import { ExecutionMap } from './ExecutionMap';
import { ExecutionPanel } from './ExecutionPanel';
import { ItineraryCard } from './ItineraryCard';
import { MissionSummary } from './MissionSummary';
import { ReplanToast } from './ReplanToast';
import { CrewStatusModal } from './CrewStatusModal';

import type { CrewConfig, QuantumSummary } from '@/features/mission/state/types';
import type { RoverVehicleId } from '@/features/mission/state/vehicles';

interface ExecutionViewProps {
  legs: Leg[];
  base: GeoPoint;
  hazards: Hazard[];
  parkings: Parking[];
  targets: Target[];
  onProcedureCompleted: (targetId: string) => void;
  projection: Projection;
  site: TerrainLayer;
  vehicleId?: RoverVehicleId;
  crew?: CrewConfig;
  /** "Crew status" (botón de la cabecera): HUD del casco. */
  crewStatusOpen?: boolean;
  onCloseCrewStatus?: () => void;
  quantumSummary?: QuantumSummary | null;
  /** La página decide la franja inferior; aquí se le pasa la tarjeta de suministros en vivo. */
  renderFooter: (supplies: ReactNode) => ReactNode;
  onReplan: () => void;
  onExit: () => void;
}

/** Modo Go completo: itinerario, mapa en vivo, panel de ejecución y resumen final. */
export function ExecutionView({
  legs,
  base,
  hazards,
  parkings,
  targets,
  onProcedureCompleted,
  projection,
  site,
  vehicleId = 'SEV_PRESSURIZED',
  crew,
  crewStatusOpen = false,
  onCloseCrewStatus,
  quantumSummary,
  renderFooter,
  onReplan,
  onExit,
}: ExecutionViewProps) {
  const sim = useSimulation({ legs, base, hazards });
  const processedCount = useRef(0);
  const targetById = useMemo(() => new Map(targets.map((t) => [t.id, t])), [targets]);
  const targetName = useCallback((id: string) => targetById.get(id)?.name, [targetById]);
  const roverCapacity = sim.state.legs.find((l) => l.mode === 'rover')?.capacity ?? 1;
  const batteryLeft = 100 * (1 - sim.state.battery / roverCapacity);

  useEffect(() => {
    const completed = sim.state.completed.slice(processedCount.current);
    processedCount.current = sim.state.completed.length;
    completed.forEach(onProcedureCompleted);
  }, [sim.state.completed, onProcedureCompleted]);

  return (
    <>
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-md p-md lg:grid-cols-[260px_1fr_380px]">
        <aside className="flex min-h-0 flex-col gap-md">
          <ItineraryCard state={sim.state} targetName={targetName} />
        </aside>
        <ExecutionMap projection={projection} site={site} sim={sim} targets={targets} parkings={parkings} base={base} hazards={hazards} vehicleId={vehicleId} />
        <aside className="scroll-thin flex min-h-0 flex-col gap-sm overflow-y-auto">
          <ExecutionPanel sim={sim} targetName={targetName} />
        </aside>
      </div>

      {renderFooter(<SuppliesCard pct={batteryLeft} hint="Vehicle battery now" />)}

      {crewStatusOpen && crew && <CrewStatusModal sim={sim} crew={crew} onClose={() => onCloseCrewStatus?.()} />}
      {sim.lastReplan && <ReplanToast key={sim.state.events.length} result={sim.lastReplan} onClose={sim.clearReplan} />}
      {sim.state.finished && (
        <MissionSummary state={sim.state} roverCapacity={roverCapacity} targetName={targetName} crew={crew} quantumSummary={quantumSummary} onReplan={onReplan} onExit={onExit} />
      )}
    </>
  );
}
