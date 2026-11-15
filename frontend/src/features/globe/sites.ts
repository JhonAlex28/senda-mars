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
  feature?: {
    catalogId: number;
    target: string;
    type: string;
    controlNetwork?: string;
    coordinateSystem: string;
    diameterKm: number;
    northmostLat: number;
    southmostLat: number;
    eastmostLon: number;
    westmostLon: number;
    quadrangle?: string;
  };
}

/**
 * Catálogo de sitios. Solo Mount Sharp tiene datos y misión preparada;
 * los demás aparecen en el globo como "Coming soon" para mostrar hacia dónde crece SENDA.
 * Coordenadas: lugares de aterrizaje publicados por cada misión.
 */
export const SITES: Site[] = [
  { id: 'mount-sharp', name: 'Mount Sharp', region: 'Gale Crater', mission: 'Curiosity', lat: -4.79, lon: 137.39, active: true },
  {
    id: 'gale-crater',
    name: 'Gale Crater',
    region: 'Aeolis · Mars',
    mission: 'Mars feature catalog',
    lat: -5.37,
    lon: 137.81,
    active: false,
    feature: {
      catalogId: 2071,
      target: 'Mars',
      type: 'Crater, craters',
      coordinateSystem: 'Planetocentric, +East, 0–360',
      diameterKm: 154.08,
      northmostLat: -4.07,
      southmostLat: -6.67,
      eastmostLon: 139.12,
      westmostLon: 136.51,
      quadrangle: 'MC23',
    },
  },
  {
    id: 'peace-vallis',
    name: 'Peace Vallis',
    region: 'Gale Crater · Aeolis',
    mission: 'Mars feature catalog',
    lat: -4.21,
    lon: 137.23,
    active: false,
    feature: {
      catalogId: 15036,
      target: 'Mars',
      type: 'Vallis, valles',
      controlNetwork: 'MDIM 2.1',
      coordinateSystem: 'Planetocentric, +East, 0–360',
      diameterKm: 35.24,
      northmostLat: -3.96,
      southmostLat: -4.42,
      eastmostLon: 137.31,
      westmostLon: 137.15,
      quadrangle: 'MC23',
    },
  },
  {
    id: 'libya-montes',
    name: 'Libya Montes',
    region: 'Mars',
    mission: 'Mars feature catalog',
    lat: 1.44,
    lon: 88.23,
    active: false,
    feature: {
      catalogId: 3391,
      target: 'Mars',
      type: 'Mons, montes',
      coordinateSystem: 'Planetocentric, +East, 0–360',
      diameterKm: 1043.63,
      northmostLat: 6.57,
      southmostLat: -1.22,
      eastmostLon: 96.59,
      westmostLon: 78.99,
    },
  },
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
