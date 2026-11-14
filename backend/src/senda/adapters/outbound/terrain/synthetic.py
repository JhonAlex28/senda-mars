"""Adaptador de salida: terreno sintético generado por fórmula (demo, sin DEM real).

Reproduce a grandes rasgos el sector: rampa que sube desde la base (NE) hasta la unidad
boxwork (SW), un cráter junto a la base, mesetas empinadas en medio del camino y la
textura de crestas del boxwork. Es determinista: la misma consulta da la misma grilla."""
from __future__ import annotations

import math

from senda.domain.models.geo import METERS_PER_DEG_LAT, BoundingBox
from senda.domain.models.terrain import TerrainGrid
from senda.domain.services.terrain_analysis import slope_deg

BASE_ELEVATION_M = -3735.0
RIDGE_TOP_ELEVATION_M = -3605.0
MAX_CELLS_PER_SIDE = 400

# Rasgos en metros locales (x al este, y al norte desde la esquina SW del sitio)
_RAMP_FROM, _RAMP_TO = (1412.0, 1633.0), (540.0, 330.0)
_BUTTES = [(990.0, 960.0, 45.0, 60.0), (760.0, 1210.0, 40.0, 55.0),
           (1260.0, 700.0, 40.0, 65.0), (1150.0, 1300.0, 25.0, 40.0)]   # x, y, alto, sigma
_CRATER = (1330.0, 1540.0, 70.0)                                      # x, y, radio
_BOXWORK = (560.0, 470.0, 380.0)                                      # x, y, alcance
_ROUGH_BAND = (930.0, 930.0, 260.0)    # centro y semiancho de la franja de dunas cruzada al camino


def _ramp(x: float, y: float) -> float:
    (x0, y0), (x1, y1) = _RAMP_FROM, _RAMP_TO
    dx, dy = x1 - x0, y1 - y0
    t = ((x - x0) * dx + (y - y0) * dy) / (dx * dx + dy * dy)
    return BASE_ELEVATION_M + (RIDGE_TOP_ELEVATION_M - BASE_ELEVATION_M) * t


def _buttes(x: float, y: float) -> float:
    return sum(h * math.exp(-((x - bx) ** 2 + (y - by) ** 2) / (2 * s * s))
               for bx, by, h, s in _BUTTES)


def _crater(x: float, y: float) -> float:
    cx, cy, radius = _CRATER
    d = math.hypot(x - cx, y - cy)
    rim = 7.0 * math.exp(-((d - radius) ** 2) / (2 * 14.0 ** 2))
    bowl = -9.0 * max(0.0, 1 - (d / radius) ** 2)
    return rim + bowl


def _boxwork(x: float, y: float) -> float:
    """Crestas cruzadas del boxwork, que se desvanecen lejos de la unidad."""
    cx, cy, reach = _BOXWORK
    weight = math.exp(-((x - cx) ** 2 + (y - cy) ** 2) / (reach * reach))
    u, v = x * 0.94 + y * 0.34, -x * 0.34 + y * 0.94
    ridges = max(0.0, math.cos(2 * math.pi * u / 70)) ** 4 + max(0.0, math.cos(2 * math.pi * v / 80)) ** 4
    return 1.6 * weight * ridges


def _rough_band(x: float, y: float) -> float:
    """Franja de dunas (pendientes de precaución) que cruza el camino directo.
    Se suaviza hacia el noroeste: el camino seguro rodea por ahí, el rápido la atraviesa."""
    cx, cy, half_width = _ROUGH_BAND
    along = ((x - cx) - (y - cy)) / math.sqrt(2)      # a lo largo de la franja (NO → SE)
    across = ((x - cx) + (y - cy)) / math.sqrt(2)
    band = math.exp(-(across / half_width) ** 2)
    fade = 1 / (1 + math.exp(-(along + 150) / 60))      # ~0 al noroeste del centro
    return 5.0 * band * fade * math.sin(across / 14.0) ** 2


def _undulation(x: float, y: float) -> float:
    return 3.0 * math.sin(x / 130) * math.cos(y / 170) + 1.5 * math.sin((x + y) / 60)


def elevation_at(x: float, y: float) -> float:
    return (_ramp(x, y) + _buttes(x, y) + _crater(x, y) + _boxwork(x, y)
            + _rough_band(x, y) + _undulation(x, y))


class SyntheticTerrainProvider:
    def __init__(self, site: BoundingBox) -> None:
        self._site = site
        self._cache: dict[tuple[BoundingBox, float], TerrainGrid] = {}

    def site_bounds(self) -> BoundingBox:
        return self._site

    def get_grid(self, bbox: BoundingBox, cell_size_m: float) -> TerrainGrid:
        key = (bbox, cell_size_m)
        if key not in self._cache:
            self._cache[key] = self._build(bbox, cell_size_m)
        return self._cache[key]

    def _build(self, bbox: BoundingBox, cell_size_m: float) -> TerrainGrid:
        cols = min(MAX_CELLS_PER_SIDE, max(2, round(bbox.width_m / cell_size_m)))
        rows = min(MAX_CELLS_PER_SIDE, max(2, round(bbox.height_m / cell_size_m)))
        x0 = (bbox.min_lon - self._site.min_lon) * self._site.meters_per_deg_lon
        y0 = (bbox.min_lat - self._site.min_lat) * METERS_PER_DEG_LAT
        dx, dy = bbox.width_m / cols, bbox.height_m / rows
        elevation = [
            [elevation_at(x0 + (c + 0.5) * dx, y0 + bbox.height_m - (r + 0.5) * dy) for c in range(cols)]
            for r in range(rows)
        ]
        return TerrainGrid(bbox, rows, cols, elevation, slope_deg(elevation, dx))
