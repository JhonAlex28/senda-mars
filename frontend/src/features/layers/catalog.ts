import { SCIENCE_TYPES, type ScienceType } from '@/features/targets';

/** De dónde sale el dato de una capa (requisito RF-1: mostrar la procedencia). */
export type Provenance = 'measured' | 'modeled' | 'assumed';

export type LayerId =
  | 'relief'
  | 'slope'
  | 'targets'
  | 'targetNames'
  | 'sci-water'
  | 'sci-mineral'
  | 'sci-drill'
  | 'sci-geology'
  | 'routes'
  | 'hazards'
  | 'imagery'
  | 'minerals'
  | 'shelter';

export interface LayerDef {
  id: LayerId;
  name: string;
  icon: string;
  provenance: Provenance;
  source: string;
  resolution: string;
  /** Imagen bajo los vectores: admite opacidad. */
  raster: boolean;
  /** false = todavía sin datos (se muestra como "Soon"). */
  available: boolean;
  defaultVisible?: boolean;
  defaultOpacity: number;
  legend?: { label: string; swatch: string }[];
  /** Subcapa: se dibuja plegada dentro de su capa padre y depende de ella. */
  parent?: LayerId;
  /** Color del icono (tipos de objetivo). */
  color?: string;
}

/**
 * Catálogo de capas. Para conectar datos reales (p. ej. teselas HiRISE o CRISM) basta con marcar la capa
 * como `available` y darle su imagen en `lib/rasters.ts`.
 */
export const LAYERS: LayerDef[] = [
  {
    id: 'relief',
    name: 'Terrain',
    icon: 'landscape',
    provenance: 'measured',
    source: 'USGS MSL Gale Merged DEM (HiRISE + CTX + MOLA)',
    resolution: '1 m boxwork · 10 m region',
    raster: true,
    available: true,
    defaultOpacity: 0.92,
    legend: [
      { label: '-4700 m', swatch: 'bg-[#46261f]' },
      { label: '-4300 m', swatch: 'bg-[#965743]' },
      { label: '-3900 m', swatch: 'bg-[#d69e72]' },
      { label: '-3000 m', swatch: 'bg-[#f2ddbb]' },
    ],
  },
  {
    id: 'slope',
    name: 'Slope',
    icon: 'trending_up',
    provenance: 'modeled',
    source: 'From the USGS DEM',
    resolution: 'Same as terrain',
    raster: true,
    available: true,
    defaultOpacity: 1,
    legend: [
      { label: '>15°', swatch: 'bg-warning' },
      { label: '>25°', swatch: 'bg-error' },
    ],
  },
  {
    id: 'targets',
    name: 'Science targets',
    icon: 'diamond',
    provenance: 'measured',
    source: 'Curiosity sites (NASA MMGIS)',
    resolution: 'Points',
    raster: false,
    available: true,
    defaultOpacity: 1,
  },
  // Subcapas de "Science targets": nombres y un interruptor por tipo científico
  {
    id: 'targetNames',
    name: 'Names',
    icon: 'label',
    provenance: 'measured',
    source: 'Curiosity sites (NASA MMGIS)',
    resolution: 'Labels',
    raster: false,
    available: true,
    defaultVisible: false,
    defaultOpacity: 1,
    parent: 'targets',
  },
  ...(Object.entries(SCIENCE_TYPES) as [ScienceType, (typeof SCIENCE_TYPES)[ScienceType]][]).map(
    ([type, meta]): LayerDef => ({
      id: `sci-${type}`,
      name: meta.label,
      icon: meta.icon,
      color: meta.color,
      provenance: 'measured',
      source: 'Target type (catalog)',
      resolution: 'Points',
      raster: false,
      available: true,
      defaultOpacity: 1,
      parent: 'targets',
    }),
  ),
  {
    id: 'routes',
    name: 'Routes',
    icon: 'route',
    provenance: 'modeled',
    source: 'SENDA planner (A*)',
    resolution: 'Terrain grid',
    raster: false,
    available: true,
    defaultOpacity: 1,
  },
  {
    id: 'hazards',
    name: 'Danger zones',
    icon: 'warning',
    provenance: 'assumed',
    source: 'Marked by the crew',
    resolution: 'Circles',
    raster: false,
    available: true,
    defaultOpacity: 1,
  },
  // En preparación: un compañero integra capas ópticas y temáticas con datos oficiales de la NASA
  {
    id: 'imagery',
    name: 'Orbital photo',
    icon: 'satellite_alt',
    provenance: 'measured',
    source: 'USGS MSL Gale HiRISE LRGB mosaic',
    resolution: '10 m/pixel (regional visualization)',
    raster: true,
    available: true,
    defaultVisible: true,
    defaultOpacity: 1,
  },
  {
    id: 'minerals',
    name: 'Minerals',
    icon: 'science',
    provenance: 'measured',
    source: 'Coming with official NASA data',
    resolution: '—',
    raster: true,
    available: false,
    defaultOpacity: 0.55,
  },
  {
    id: 'shelter',
    name: 'Radiation shelter',
    icon: 'shield',
    provenance: 'modeled',
    source: 'Coming with official NASA data',
    resolution: '—',
    raster: true,
    available: false,
    defaultOpacity: 0.55,
  },
];
