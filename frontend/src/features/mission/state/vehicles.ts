export type RoverVehicleId = 'SEV_PRESSURIZED' | 'LTV_UNPRESSURIZED' | 'HYBRID_ROVER';

export interface RoverVehicleSpec {
  id: RoverVehicleId;
  name: string;
  shortName: string;
  defaultSpeedKmh: number;
  minSpeedKmh: number;
  maxSpeedKmh: number;
  rangeKm: number;
  batteryKwh: number;
  transitO2Pct: number;
  enduranceLabel: string;
  description: string;
}

export const ROVER_VEHICLES: Record<RoverVehicleId, RoverVehicleSpec> = {
  SEV_PRESSURIZED: {
    id: 'SEV_PRESSURIZED',
    name: 'Crew rover with closed cabin',
    shortName: 'Crew rover',
    defaultSpeedKmh: 8.0,
    minSpeedKmh: 4.0,
    maxSpeedKmh: 12.0,
    rangeKm: 100,
    batteryKwh: 42.0,
    transitO2Pct: 0,
    enduranceLabel: 'Up to 14 days · crew rides without suits',
    description:
      'The vehicle that drives the crew to the science sites. Its cabin has air, so astronauts ride without spacesuits and only use suit oxygen once they step out to walk. Based on NASA’s Space Exploration Vehicle (SEV).',
  },
  LTV_UNPRESSURIZED: {
    id: 'LTV_UNPRESSURIZED',
    name: 'Open rover (crew in suits)',
    shortName: 'Open rover',
    defaultSpeedKmh: 12.0,
    minSpeedKmh: 6.0,
    maxSpeedKmh: 16.0,
    rangeKm: 25,
    batteryKwh: 18.0,
    transitO2Pct: 38,
    enduranceLabel: 'Up to 8 h · crew wears suits the whole time',
    description:
      'A lighter, faster vehicle with no cabin. The crew wears spacesuits while driving, so it spends suit oxygen on the way.',
  },
  HYBRID_ROVER: {
    id: 'HYBRID_ROVER',
    name: 'Support rover (suit hookup)',
    shortName: 'Support rover',
    defaultSpeedKmh: 10.0,
    minSpeedKmh: 5.0,
    maxSpeedKmh: 14.0,
    rangeKm: 60,
    batteryKwh: 28.0,
    transitO2Pct: 15,
    enduranceLabel: 'Up to 48 h · suits plug into the vehicle',
    description:
      'Suits plug into the vehicle while driving, so they use far less of their own oxygen on the way.',
  },
};
