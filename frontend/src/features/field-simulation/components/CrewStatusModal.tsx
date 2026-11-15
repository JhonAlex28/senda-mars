import { HelmetStatusCard, type CrewConfig } from '@/features/mission';
import { Dialog } from '@/shared/ui/Dialog';
import type { Simulation } from '../hooks/useSimulation';

interface CrewStatusModalProps {
  sim: Simulation;
  crew: CrewConfig;
  onClose: () => void;
}

/**
 * "Crew status" durante la ejecución: HUD del casco de cada astronauta.
 * El O₂ del traje sale del motor (consumo de la ruta planificada). Pulso, temperatura del
 * LCVG, CO₂ y presión son SIMULADOS (no hay telemetría real) y así se rotula.
 */
export function CrewStatusModal({ sim, crew, onClose }: CrewStatusModalProps) {
  const { state, leg } = sim;
  const walking = leg.mode === 'eva';
  const effort = walking ? 1.35 : 0.72;
  const suitPct = walking ? Math.max(0, Math.round(100 * (1 - state.suitO2 / leg.capacity))) : 100;
  const co2Pct = Number((0.49 * effort * (state.conditions.o2_multiplier > 1 ? 1.15 : 1)).toFixed(2));

  return (
    <Dialog title="Crew status" icon="monitor_heart" onClose={onClose}>
      <p className="mb-sm font-label text-label-sm uppercase text-warning">Simulated vitals · O₂ from planner</p>
      <div className="flex flex-col gap-sm">
        {crew.members.map((m, i) => (
          <HelmetStatusCard
            key={m.id}
            astronautName={m.name || m.id}
            suitId={m.suitId}
            tempC={Number((16.6 + (walking ? 1.1 : 0) + Math.sin(state.clock * 0.2 + i) * 0.3).toFixed(1))}
            o2Pct={suitPct}
            co2Pct={co2Pct}
            pressureKpa={walking ? 29.6 : 57.0}
            heartRateBpm={Math.round(m.restingBpm + (walking ? 40 : 8) + Math.sin(state.clock * 0.4 + i) * 4)}
            valPct={Math.round(35 * effort)}
            statusLabel={walking ? 'EVA' : 'IN SEV'}
          />
        ))}
      </div>
    </Dialog>
  );
}
