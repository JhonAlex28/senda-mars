"""Grilla de terreno usada por el planificador.
Fila 0 = borde norte (max_lat); columna 0 = borde oeste (min_lon)."""
from __future__ import annotations

from dataclasses import dataclass

from senda.domain.models.geo import BoundingBox, GeoPoint

Cell = tuple[int, int]


@dataclass(frozen=True)
class TerrainGrid:
    bbox: BoundingBox
    rows: int
    cols: int
    elevation_m: list[list[float]]
    slope_deg: list[list[float]]

    @property
    def cell_size_m(self) -> float:
        return self.bbox.width_m / self.cols

    def cell_of(self, p: GeoPoint) -> Cell:
        """Celda que contiene el punto (se recorta al borde si cae fuera)."""
        b = self.bbox
        col = int((p.lon - b.min_lon) / (b.max_lon - b.min_lon) * self.cols)
        row = int((b.max_lat - p.lat) / (b.max_lat - b.min_lat) * self.rows)
        return min(max(row, 0), self.rows - 1), min(max(col, 0), self.cols - 1)

    def point_of(self, cell: Cell) -> GeoPoint:
        """Centro geográfico de la celda."""
        b = self.bbox
        row, col = cell
        lon = b.min_lon + (col + 0.5) / self.cols * (b.max_lon - b.min_lon)
        lat = b.max_lat - (row + 0.5) / self.rows * (b.max_lat - b.min_lat)
        return GeoPoint(lon, lat)

    def elevation(self, cell: Cell) -> float:
        return self.elevation_m[cell[0]][cell[1]]

    def slope(self, cell: Cell) -> float:
        return self.slope_deg[cell[0]][cell[1]]
