"""GridSpec: único lugar donde se convierte (fila, col) <-> (x, y) <-> (lon, lat).

Proyección equirectangular de Mec. A (grid.json):
    +proj=eqc +lat_ts=0 +lon_0=0 +R=<radio> +units=m
    x = R * lon_rad,  y = R * lat_rad
Convención de celdas: origen en la esquina superior izquierda (origin_xy = borde
superior izquierdo del píxel [0, 0], "pixel is area"); la fila crece hacia el sur
y la columna hacia el este. Las coordenadas de una celda son las de su centro.
"""
from __future__ import annotations

import math
import re
from dataclasses import dataclass

from senda.domain.models.geo import BoundingBox, GeoPoint

Cell = tuple[int, int]

# Esfera usada por los productos USGS/MOLA (IAU 2000). Ver doc §4.0.
MARS_EQC_RADIUS_M = 3_396_190.0


@dataclass(frozen=True)
class GridSpec:
    origin_x: float          # m, borde izquierdo
    origin_y: float          # m, borde superior
    cell_size_m: float
    rows: int
    cols: int
    radius_m: float = MARS_EQC_RADIUS_M

    # ---- constructores ---------------------------------------------------
    @classmethod
    def from_bbox(cls, bbox: BoundingBox, cell_size_m: float,
                  radius_m: float = MARS_EQC_RADIUS_M) -> "GridSpec":
        x0 = radius_m * math.radians(bbox.min_lon)
        x1 = radius_m * math.radians(bbox.max_lon)
        y0 = radius_m * math.radians(bbox.min_lat)
        y1 = radius_m * math.radians(bbox.max_lat)
        cols = max(1, int(round((x1 - x0) / cell_size_m)))
        rows = max(1, int(round((y1 - y0) / cell_size_m)))
        return cls(origin_x=x0, origin_y=y1, cell_size_m=cell_size_m,
                   rows=rows, cols=cols, radius_m=radius_m)

    @classmethod
    def from_grid_json(cls, d: dict) -> "GridSpec":
        """Lee el grid.json que entrega Mec. A (doc §4.2)."""
        radius = MARS_EQC_RADIUS_M
        m = re.search(r"\+R=([0-9.]+)", d.get("crs_proj4", ""))
        if m:
            radius = float(m.group(1))
        rows, cols = d["shape"]
        x0, y0 = d["origin_xy"]
        return cls(origin_x=float(x0), origin_y=float(y0),
                   cell_size_m=float(d["cell_size_m"]), rows=int(rows), cols=int(cols),
                   radius_m=radius)

    # ---- conversiones ----------------------------------------------------
    @property
    def shape(self) -> tuple[int, int]:
        return (self.rows, self.cols)

    def cell_to_xy(self, cell: Cell) -> tuple[float, float]:
        r, c = cell
        return (self.origin_x + (c + 0.5) * self.cell_size_m,
                self.origin_y - (r + 0.5) * self.cell_size_m)

    def xy_to_cell(self, x: float, y: float) -> Cell:
        c = int(math.floor((x - self.origin_x) / self.cell_size_m))
        r = int(math.floor((self.origin_y - y) / self.cell_size_m))
        return (r, c)

    def lonlat_to_cell(self, lon: float, lat: float) -> Cell:
        return self.xy_to_cell(self.radius_m * math.radians(lon),
                               self.radius_m * math.radians(lat))

    def cell_to_lonlat(self, cell: Cell) -> tuple[float, float]:
        x, y = self.cell_to_xy(cell)
        return (math.degrees(x / self.radius_m), math.degrees(y / self.radius_m))

    def cell_to_geopoint(self, cell: Cell) -> GeoPoint:
        lon, lat = self.cell_to_lonlat(cell)
        return GeoPoint(lon=lon, lat=lat)

    def contains(self, cell: Cell) -> bool:
        return 0 <= cell[0] < self.rows and 0 <= cell[1] < self.cols

    @property
    def bbox(self) -> BoundingBox:
        lon0 = math.degrees(self.origin_x / self.radius_m)
        lat1 = math.degrees(self.origin_y / self.radius_m)
        lon1 = math.degrees((self.origin_x + self.cols * self.cell_size_m) / self.radius_m)
        lat0 = math.degrees((self.origin_y - self.rows * self.cell_size_m) / self.radius_m)
        return BoundingBox(min_lon=lon0, min_lat=lat0, max_lon=lon1, max_lat=lat1)
