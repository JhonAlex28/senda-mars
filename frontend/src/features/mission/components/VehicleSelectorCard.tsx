import { Card } from '@/shared/ui/Card';
import { Icon } from '@/shared/ui/Icon';
import { Live } from '@/shared/ui/Text';
import { ROVER_VEHICLES, type RoverVehicleId } from '../state/vehicles';

interface VehicleSelectorCardProps {
  vehicleId: RoverVehicleId;
  speedKmh: number;
  distanceM?: number;
  onChangeVehicle: (id: RoverVehicleId) => void;
  onChangeSpeed: (speedKmh: number) => void;
}

/** El vehículo de la tripulación, explicado sin siglas, y su velocidad de viaje. */
export function VehicleSelectorCard({ speedKmh, distanceM, onChangeSpeed }: VehicleSelectorCardProps) {
  const spec = ROVER_VEHICLES.SEV_PRESSURIZED;
  const driveMin = distanceM ? Math.max(1, Math.round((distanceM / 1000 / speedKmh) * 60)) : null;

  return (
    <Card
      title={
        <span className="flex items-center gap-xs">
          <Icon name="airport_shuttle" className="text-[20px] text-accent" />
          Your vehicle
        </span>
      }
      className="gap-sm"
    >
      <div>
        <p className="font-body text-body-md font-semibold text-on-surface">{spec.name}</p>
        <p className="mt-[2px] font-body text-body-sm leading-snug text-on-surface-variant">{spec.description}</p>
      </div>

      <label className="flex flex-col gap-1">
        <span className="flex items-center justify-between font-body text-body-sm text-on-surface">
          Driving speed
          <Live className="font-mono text-mono-sm font-bold text-accent">{speedKmh.toFixed(1)} km/h</Live>
        </span>
        <input
          type="range"
          min={spec.minSpeedKmh}
          max={spec.maxSpeedKmh}
          step={0.5}
          value={speedKmh}
          onChange={(e) => onChangeSpeed(parseFloat(e.target.value))}
          className="w-full accent-primary"
          aria-label="Driving speed"
        />
        <span className="flex justify-between font-body text-[11px] text-on-surface-variant">
          <span>Slower, uses less battery</span>
          <span>Faster</span>
        </span>
      </label>

      <div className="grid grid-cols-3 gap-xs">
        <Fact icon="straighten" label="Can travel" value={`${spec.rangeKm} km`} hint="Furthest distance on one charge" />
        <Fact icon="battery_charging_full" label="Battery" value={`${spec.batteryKwh} kWh`} hint="Energy stored in the vehicle" />
        <Fact
          icon="air"
          label="Suit air used"
          value={spec.transitO2Pct === 0 ? 'None' : `${spec.transitO2Pct}%`}
          hint="Spacesuit oxygen spent while driving (the cabin has its own air)"
        />
      </div>

      {driveMin !== null && (
        <div className="flex items-center justify-between rounded-md border border-outline-variant bg-surface px-sm py-xs">
          <span className="flex items-center gap-xs font-body text-body-sm text-on-surface-variant">
            <Icon name="schedule" className="text-[16px] text-accent" />
            Driving time, about
          </span>
          <Live className="font-mono text-mono-sm font-bold text-on-surface">
            {(distanceM! / 1000).toFixed(1)} km · {driveMin} min
          </Live>
        </div>
      )}
    </Card>
  );
}

function Fact({ icon, label, value, hint }: { icon: string; label: string; value: string; hint: string }) {
  return (
    <div className="rounded-md border border-outline-variant bg-surface p-xs" title={hint}>
      <span className="flex items-center gap-[3px] font-body text-[11px] text-on-surface-variant">
        <Icon name={icon} className="text-[13px] text-accent" />
        {label}
      </span>
      <Live className="font-mono text-mono-sm font-bold text-on-surface">{value}</Live>
    </div>
  );
}
