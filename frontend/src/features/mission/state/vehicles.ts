/**
 * Vehículo de la tripulación: el SEV presurizado de la NASA (decisión del MVP, doc §0.4).
 * Fuente: https://science.nasa.gov/3d-resources/space-exploration-vehicle/
 * (cabina presurizada para 2 astronautas hasta 14 días, ~10 km/h, 12 ruedas). La NASA no publica
 * batería ni autonomía: esas cifras salen del planificador (mission_params.json) y se muestran por ruta.
 */
export type RoverVehicleId = 'SEV_PRESSURIZED';

export interface RoverVehicleSpec {
  id: RoverVehicleId;
  name: string;
  shortName: string;
  crew: number;
  enduranceDays: number;
  topSpeedKmh: number;
  wheels: number;
  source: string;
}

export const ROVER_VEHICLES: Record<RoverVehicleId, RoverVehicleSpec> = {
  SEV_PRESSURIZED: {
    id: 'SEV_PRESSURIZED',
    name: 'Pressurized vehicle (SEV)',
    shortName: 'SEV',
    crew: 2,
    enduranceDays: 14,
    topSpeedKmh: 10,
    wheels: 12,
    source: 'https://science.nasa.gov/3d-resources/space-exploration-vehicle/',
  },
};
