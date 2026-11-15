/** De dónde sale el dato de una capa (requisito RF-1: mostrar la procedencia). */
export type Provenance = 'measured' | 'modeled' | 'assumed';

export type LayerId = 'relief' | 'slope' | 'targets' | 'routes' | 'hazards' | 'imagery' | 'minerals' | 'shelter';

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
    resolution: '10 m per cell · 3 m near rover stops (from 1 m DEM)',
    raster: true,
    available: true,
    defaultOpacity: 0.92,
  },
  {
    id: 'slope',
    name: 'Slope',
    icon: 'trending_up',
    provenance: 'modeled',
    source: 'Computed from the USGS DEM',
    resolution: 'Same as terrain',
    raster: true,
    available: true,
    defaultOpacity: 1,
    legend: [
      { label: '>10°', swatch: 'bg-warning' },
      { label: '>18°', swatch: 'bg-error' },
    ],
  },
  {
    id: 'targets',
    name: 'Science targets',
    icon: 'diamond',
    provenance: 'measured',
    source: 'Curiosity rover campaigns',
    resolution: 'Points',
    raster: false,
    available: true,
    defaultOpacity: 1,
  },
  {
    id: 'routes',
    name: 'Routes',
    icon: 'route',
    provenance: 'modeled',
    source: 'SENDA A* route planner',
    resolution: 'Follows the terrain grid',
    raster: false,
    available: true,
    defaultOpacity: 1,
  },
  {
    id: 'hazards',
    name: 'Danger zones',
    icon: 'warning',
    provenance: 'assumed',
    source: 'Marked by the crew on the map',
    resolution: 'Circles',
    raster: false,
    available: true,
    defaultOpacity: 1,
  },
  {
    id: 'imagery',
    name: 'Orbital photo',
    icon: 'satellite_alt',
    provenance: 'measured',
    source: 'NASA Mars Trek · MRO CTX Gale Mosaic',
    resolution: '6 m per pixel',
    raster: true,
    available: true,
    defaultVisible: false,
    defaultOpacity: 0.85,
  },
  {
    id: 'minerals',
    name: 'Minerals',
    icon: 'science',
    // Unidades pintadas por franjas de altura del DEM (modelo de estratos), con textura THEMIS real
    provenance: 'modeled',
    source: 'Mount Sharp units by elevation band (model) + MO THEMIS-IR Day texture',
    resolution: 'DEM cells / THEMIS 100 m',
    raster: true,
    available: true,
    defaultVisible: false,
    defaultOpacity: 0.55,
    legend: [
      { label: 'Murray / Glen Torridon Clay', swatch: 'bg-accent' },
      { label: 'Stimson Sandstone', swatch: 'bg-warning' },
      { label: 'Sulfate Boxwork', swatch: 'bg-route-science' },
    ],
  },
  {
    id: 'shelter',
    name: 'Radiation shelter',
    icon: 'shield',
    provenance: 'modeled',
    source: 'Curiosity RAD (0.64–0.67 mSv/sol) + MOLA/HRSC',
    resolution: 'Relative estimate',
    raster: true,
    available: true,
    defaultVisible: false,
    defaultOpacity: 0.55,
    legend: [{ label: 'Cliff / Crater Shielding', swatch: 'bg-success' }],
  },
];
