import { Card } from '@/shared/ui/Card';
import { ROVER_VEHICLES, type RoverVehicleId } from '../state/vehicles';

interface VehicleSelectorCardProps {
  vehicleId: RoverVehicleId;
  speedKmh: number;
  distanceM?: number;
  onChangeVehicle: (id: RoverVehicleId) => void;
  onChangeSpeed: (speedKmh: number) => void;
}

/** Pressurized Rover (SEV) status & cruise speed control. */
export function VehicleSelectorCard({
  speedKmh,
  distanceM,
  onChangeSpeed,
}: VehicleSelectorCardProps) {
  const spec = ROVER_VEHICLES.SEV_PRESSURIZED;
  const estRoverMin = distanceM ? Math.max(1, Math.round((distanceM / 1000 / speedKmh) * 60)) : null;

  return (
    <Card title="Pressurized Rover (SEV)" className="gap-xs">
      <div className="flex items-center justify-between rounded border border-accent/40 bg-surface px-sm py-xs font-mono text-mono-sm">
        <span className="font-bold text-on-surface">{spec.name}</span>
        <span className="text-[10px] text-emerald-400">57 kPa · 100 km EZ</span>
      </div>

      <p className="text-body-sm leading-snug text-on-surface-variant">{spec.description}</p>

      <div className="flex flex-col gap-1 pt-xs">
        <div className="flex items-center justify-between font-mono text-mono-sm">
          <span className="text-on-surface-variant">CRUISE SPEED</span>
          <span className="font-bold text-accent">{speedKmh.toFixed(1)} km/h</span>
        </div>
        <input
          type="range"
          min={spec.minSpeedKmh}
          max={spec.maxSpeedKmh}
          step={0.5}
          value={speedKmh}
          onChange={(e) => onChangeSpeed(parseFloat(e.target.value))}
          className="w-full accent-primary"
        />
      </div>

      <div className="grid grid-cols-3 gap-xs rounded border border-outline-variant bg-surface p-xs font-mono text-mono-sm">
        <div>
          <div className="text-[10px] text-on-surface-variant">EZ RANGE</div>
          <div className="font-bold text-emerald-400">{spec.rangeKm} km</div>
        </div>
        <div>
          <div className="text-[10px] text-on-surface-variant">BATTERY</div>
          <div className="font-bold text-on-surface">{spec.batteryKwh} kWh</div>
        </div>
        <div>
          <div className="text-[10px] text-on-surface-variant">PLSS O₂</div>
          <div className="font-bold text-accent">{spec.transitO2Pct}%</div>
        </div>
      </div>

      {estRoverMin !== null && (
        <div className="flex items-center justify-between rounded border border-outline-variant bg-surface-container-high px-sm py-xs font-mono text-mono-sm">
          <span className="text-on-surface-variant">ROVER TRANSIT EST.</span>
          <span className="font-bold text-on-surface">
            {(distanceM! / 1000).toFixed(2)} km · {estRoverMin} min
          </span>
        </div>
      )}
    </Card>
  );
}
