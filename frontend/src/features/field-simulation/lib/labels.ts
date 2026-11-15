import type { LegStop } from './itinerary';

/** Nombre legible de una parada ("Altadena", "Rover P1", "Base"). */
export function stopLabel(stop: LegStop, targetName: (id: string) => string | undefined): string {
  switch (stop.kind) {
    case 'target':
      return targetName(stop.refId) ?? stop.refId;
    case 'parking':
      return `Rover stop ${stop.refId}`;
    case 'rover':
      return 'The rover';
    case 'base':
      return 'Base Alpha';
    default:
      return 'Waypoint';
  }
}

export const MODE_ICON = { rover: 'airport_shuttle', eva: 'directions_walk' } as const;
