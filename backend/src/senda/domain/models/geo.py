"""Value objects geográficos. Sin dependencias externas."""
from __future__ import annotations

import math
from dataclasses import dataclass

MARS_RADIUS_M = 3_389_500.0


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
