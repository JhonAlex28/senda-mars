/** Lugar de Marte que se puede explorar (o que se añadirá más adelante). */
export interface Site {
  id: string;
  name: string;
  region: string;
  /** Misión de la NASA (u otra) que estudió el lugar: contexto para el usuario. */
  mission: string;
  lat: number; // °N
  lon: number; // °E, de -180 a 180
  active: boolean;
}

/**
 * Catálogo de sitios. Solo Mount Sharp tiene datos y misión preparada;
 * los demás aparecen en el globo como "Coming soon" para mostrar hacia dónde crece SENDA.
 * Coordenadas: lugares de aterrizaje publicados por cada misión.
 */
export const SITES: Site[] = [
  { id: 'mount-sharp', name: 'Mount Sharp', region: 'Gale Crater', mission: 'Curiosity', lat: -4.79, lon: 137.39, active: true },
  { id: 'jezero', name: 'Jezero Crater', region: 'Isidis Planitia', mission: 'Perseverance', lat: 18.44, lon: 77.45, active: false },
  { id: 'gusev', name: 'Gusev Crater', region: 'Aeolis', mission: 'Spirit', lat: -14.57, lon: 175.47, active: false },
  { id: 'meridiani', name: 'Meridiani Planum', region: 'Terra Meridiani', mission: 'Opportunity', lat: -1.95, lon: -5.53, active: false },
  { id: 'utopia', name: 'Utopia Planitia', region: 'Northern plains', mission: 'Zhurong', lat: 25.07, lon: 109.93, active: false },
];

export function formatLatLon(site: Pick<Site, 'lat' | 'lon'>): string {
  const lat = `${Math.abs(site.lat).toFixed(2)}°${site.lat < 0 ? 'S' : 'N'}`;
  const lon = `${Math.abs(site.lon).toFixed(2)}°${site.lon < 0 ? 'W' : 'E'}`;
  return `${lat} ${lon}`;
}
