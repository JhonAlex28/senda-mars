export interface GeoPoint {
  lon: number;
  lat: number;
}

/** Espejo del DTO BBoxDto del backend. */
export interface BBox {
  min_lon: number;
  min_lat: number;
  max_lon: number;
  max_lat: number;
}
