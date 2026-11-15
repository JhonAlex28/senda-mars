"""Value objects geográficos. Sin dependencias externas."""
from __future__ import annotations

import math
from dataclasses import dataclass

MARS_RADIUS_M = 3_389_500.0
METERS_PER_DEG_LAT = math.pi * MARS_RADIUS_M / 180.0


@dataclass(frozen=True)
class GeoPoint:
    lon: float
    lat: float

    def distance_to(self, other: "GeoPoint") -> float:
        """Distancia de gran círculo en metros sobre Marte (haversine)."""
        p1, p2 = math.radians(self.lat), math.radians(other.lat)
        dp = p2 - p1
        dl = math.radians(other.lon - self.lon)
        a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
        return 2 * MARS_RADIUS_M * math.asin(math.sqrt(a))


@dataclass(frozen=True)
class BoundingBox:
    min_lon: float
    min_lat: float
    max_lon: float
    max_lat: float

    @property
    def meters_per_deg_lon(self) -> float:
        mid_lat = (self.min_lat + self.max_lat) / 2
        return METERS_PER_DEG_LAT * math.cos(math.radians(mid_lat))

    @property
    def width_m(self) -> float:
        return (self.max_lon - self.min_lon) * self.meters_per_deg_lon

    @property
    def height_m(self) -> float:
        return (self.max_lat - self.min_lat) * METERS_PER_DEG_LAT

    def contains(self, p: GeoPoint) -> bool:
        return self.min_lon <= p.lon <= self.max_lon and self.min_lat <= p.lat <= self.max_lat

    def intersect(self, other: "BoundingBox") -> "BoundingBox":
        return BoundingBox(max(self.min_lon, other.min_lon), max(self.min_lat, other.min_lat),
                           min(self.max_lon, other.max_lon), min(self.max_lat, other.max_lat))

    @classmethod
    def around(cls, points: list[GeoPoint], margin_m: float) -> "BoundingBox":
        """Caja mínima que contiene los puntos, ampliada margin_m por cada lado."""
        lons, lats = [p.lon for p in points], [p.lat for p in points]
        box = cls(min(lons), min(lats), max(lons), max(lats))
        dlon, dlat = margin_m / box.meters_per_deg_lon, margin_m / METERS_PER_DEG_LAT
        return cls(box.min_lon - dlon, box.min_lat - dlat, box.max_lon + dlon, box.max_lat + dlat)
