import type { LegStop } from './itinerary';

/** Nombre legible de una parada ("Altadena", "Stop P1", "Base"). */
export function stopLabel(stop: LegStop, targetName: (id: string) => string | undefined): string {
  switch (stop.kind) {
    case 'target':
      return targetName(stop.refId) ?? stop.refId;
    case 'parking':
      return `Stop ${stop.refId}`;
    case 'rover':
      return 'Vehicle';
    case 'base':
      return 'Base';
    default:
      return stop.refId || 'Waypoint';
  }
}

export const MODE_ICON = { rover: 'airport_shuttle', eva: 'directions_walk' } as const;
