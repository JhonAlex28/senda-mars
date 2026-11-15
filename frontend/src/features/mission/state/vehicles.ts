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
    name: 'Pressurized Rover (SEV)',
    shortName: 'SEV Pressurized',
    defaultSpeedKmh: 8.0,
    minSpeedKmh: 4.0,
    maxSpeedKmh: 12.0,
    rangeKm: 100,
    batteryKwh: 42.0,
    transitO2Pct: 0,
    enduranceLabel: '14 days · 57 kPa shirtsleeve cabin',
    description:
      'NASA Space Exploration Vehicle: pressurized 57 kPa cabin supports 100 km Exploration Zone sorties with 0% PLSS O₂ draw until Foot EVA deploy.',
  },
  LTV_UNPRESSURIZED: {
    id: 'LTV_UNPRESSURIZED',
    name: 'Unpressurized Rover (LTV)',
    shortName: 'LTV Unpressurized',
    defaultSpeedKmh: 12.0,
    minSpeedKmh: 6.0,
    maxSpeedKmh: 16.0,
    rangeKm: 25,
    batteryKwh: 18.0,
    transitO2Pct: 38,
    enduranceLabel: '8 h · Open chassis (xEMU suit active)',
    description:
      'Lightweight Unpressurized Rover: faster over flat regolith (12 km/h, 25 km EZ) while crew remains in pressurized xEMU suits (38% O₂ rate).',
  },
  HYBRID_ROVER: {
    id: 'HYBRID_ROVER',
    name: 'Hybrid Support Rover',
    shortName: 'Hybrid Rover',
    defaultSpeedKmh: 10.0,
    minSpeedKmh: 5.0,
    maxSpeedKmh: 14.0,
    rangeKm: 60,
    batteryKwh: 28.0,
    transitO2Pct: 15,
    enduranceLabel: '48 h · Umbilical suit-port feed',
    description:
      'Hybrid Surface Mobility Platform: umbilical suit-port feed cuts PLSS O₂ draw by 85% during transit to the forward EVA staging hub.',
  },
};
