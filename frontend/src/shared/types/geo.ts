export type LonLat = [lon: number, lat: number];

export interface BBox {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
}
