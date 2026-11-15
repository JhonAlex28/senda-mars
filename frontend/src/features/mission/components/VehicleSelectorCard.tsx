import { formatDistance, formatMinutes } from '@/shared/lib/format';
import { Icon } from '@/shared/ui/Icon';
import { Live } from '@/shared/ui/Text';
import { ROVER_VEHICLES } from '../state/vehicles';

interface VehicleCardProps {
  /** Ruta elegida del vehículo (del backend), si ya está planificada. */
  distanceM?: number;
  driveMin?: number;
}

/**
 * El vehículo de la tripulación: SEV presurizado. Datos de la ficha de la NASA
 * (science.nasa.gov/3d-resources/space-exploration-vehicle). La distancia y el tiempo son los
 * de la ruta planificada (no se publica la autonomía del SEV).
 */
export function VehicleSelectorCard({ distanceM, driveMin }: VehicleCardProps) {
  const spec = ROVER_VEHICLES.SEV_PRESSURIZED;
  return (
    <div className="flex flex-col gap-sm rounded-lg border border-outline bg-surface-container p-sm">
      <a href={spec.source} target="_blank" rel="noreferrer" className="flex items-center gap-xs font-headline text-title-md text-on-surface hover:text-accent">
        <Icon name="airport_shuttle" className="text-[22px] text-accent" />
        {spec.name}
      </a>
      <div className="grid grid-cols-4 gap-xs">
        <Fact icon="groups" label="Crew" value={String(spec.crew)} />
        <Fact icon="event" label="Days" value={`${spec.enduranceDays}`} />
        <Fact icon="speed" label="Top" value={`${spec.topSpeedKmh} km/h`} />
        <Fact icon="air" label="Suit O₂" value="None" />
      </div>
      {distanceM !== undefined && driveMin !== undefined && (
        <div className="flex items-center justify-between rounded-md bg-surface px-sm py-xs">
          <Icon name="route" className="text-[18px] text-accent" />
          <Live className="font-mono text-mono-sm font-bold text-on-surface">
            {formatDistance(distanceM)} · {formatMinutes(driveMin)}
          </Live>
        </div>
      )}
    </div>
  );
}

function Fact({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex flex-col items-center rounded-md bg-surface p-xs">
      <Icon name={icon} className="text-[18px] text-accent" />
      <Live className="font-mono text-mono-sm font-bold text-on-surface">{value}</Live>
      <span className="font-label text-[11px] uppercase text-on-surface-variant">{label}</span>
    </div>
  );
}
