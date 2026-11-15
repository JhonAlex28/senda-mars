"""Adaptador de salida: terreno real de Gale a partir del DEM del USGS.

Fuente: *MSL Gale Merged DEM 1 m* (MRO HiRISE + CTX, MGS MOLA), recortado y exportado a
NumPy por el equipo de terreno (ver docs/terrain-data.md). Hay dos grillas:
  local     1 m/celda, cubre el sitio de la misión (caminatas EVA)
  regional  10 m/celda, más amplia (rover)

Cada grid.json trae la proyección equirectangular marciana (R = 3 396 190 m, lon_0 = 0,
lat_ts = 0) y el origen de la esquina superior izquierda, así que:
  x = R·lon,  y = R·lat (en radianes);  col = (x − x0)/celda,  fila = (y0 − y)/celda

Para una consulta (caja + tamaño de celda) se elige la grilla más fina que no sobre: si la
celda pedida es de 10 m o más, la regional; si no, la local. Cada celda de salida es la
media del bloque de celdas del DEM que cubre (imagen integral), no un píxel suelto: así
una grilla gruesa no pierde ni inventa pendientes por muestreo."""
from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

import numpy as np

from senda.domain.models.geo import BoundingBox
from senda.domain.models.terrain import TerrainGrid
from senda.domain.services.terrain_analysis import slope_deg

MAX_CELLS_PER_SIDE = 400


@dataclass(frozen=True)
class _DemGrid:
    name: str
    radius_m: float
    origin_x: float
    origin_y: float
    cell_m: float
    bbox: BoundingBox
    integral: np.ndarray     # suma acumulada 2D con una fila/columna de ceros delante

    @classmethod
    def load(cls, folder: Path) -> "_DemGrid":
        meta = json.loads((folder / "grid.json").read_text(encoding="utf-8"))
        dem = np.load(folder / "dem.npy").astype(np.float64)
        if np.isnan(dem).any():   # el paquete actual no tiene huecos; por si una versión futura sí
            dem = np.where(np.isnan(dem), np.nanmean(dem), dem)
        integral = np.zeros((dem.shape[0] + 1, dem.shape[1] + 1))
        integral[1:, 1:] = dem.cumsum(0).cumsum(1)
        radius = float(meta["crs_proj4"].split("+R=")[1].split()[0])
        return cls(meta["scale"], radius, float(meta["origin_xy"][0]),
                   float(meta["origin_xy"][1]), float(meta["cell_size_m"]),
                   BoundingBox(*meta["bbox_lonlat"]), integral)

    @property
    def shape(self) -> tuple[int, int]:
        return self.integral.shape[0] - 1, self.integral.shape[1] - 1

    def covers(self, bbox: BoundingBox) -> bool:
        b = self.bbox
        return (b.min_lon <= bbox.min_lon and bbox.max_lon <= b.max_lon
                and b.min_lat <= bbox.min_lat and bbox.max_lat <= b.max_lat)

    def block_means(self, bbox: BoundingBox, rows: int, cols: int) -> np.ndarray:
        """Elevación media de cada celda de una grilla rows×cols sobre bbox (fila 0 = norte)."""
        lons = np.linspace(bbox.min_lon, bbox.max_lon, cols + 1)
        lats = np.linspace(bbox.max_lat, bbox.min_lat, rows + 1)
        n_rows, n_cols = self.shape
        c = np.clip(np.round((self.radius_m * np.radians(lons) - self.origin_x) / self.cell_m),
                    0, n_cols).astype(int)
        r = np.clip(np.round((self.origin_y - self.radius_m * np.radians(lats)) / self.cell_m),
                    0, n_rows).astype(int)
        # Cada bloque cubre al menos una celda del DEM (cuando la salida es más fina que la fuente)
        c1 = np.maximum(c[1:], c[:-1] + 1).clip(max=n_cols)
        r1 = np.maximum(r[1:], r[:-1] + 1).clip(max=n_rows)
        c0, r0 = np.minimum(c[:-1], c1 - 1), np.minimum(r[:-1], r1 - 1)
        s = self.integral
        total = (s[r1][:, c1] - s[r0][:, c1] - s[r1][:, c0] + s[r0][:, c0])
        area = np.outer(r1 - r0, c1 - c0)
        return total / area


class NpyDemTerrainProvider:
    def __init__(self, site: BoundingBox, terrain_dir: Path) -> None:
        self._site = site
        grids = [_DemGrid.load(terrain_dir / name) for name in ("local", "regional")
                 if (terrain_dir / name / "dem.npy").is_file()]
        if not grids:
            raise FileNotFoundError(f"No DEM found under {terrain_dir}")
        self._grids = sorted(grids, key=lambda g: g.cell_m)   # la más fina primero
        self._cache: dict[tuple[BoundingBox, float], TerrainGrid] = {}

    def site_bounds(self) -> BoundingBox:
        return self._site

    def get_grid(self, bbox: BoundingBox, cell_size_m: float) -> TerrainGrid:
        key = (bbox, cell_size_m)
        if key not in self._cache:
            self._cache[key] = self._build(bbox, cell_size_m)
        return self._cache[key]

    def source_for(self, bbox: BoundingBox, cell_size_m: float) -> str:
        return self._pick(bbox, cell_size_m).name

    def _pick(self, bbox: BoundingBox, cell_size_m: float) -> _DemGrid:
        covering = [g for g in self._grids if g.covers(bbox)] or self._grids
        # La más gruesa que siga siendo igual o más fina que lo pedido (menos trabajo, mismo detalle)
        fine_enough = [g for g in covering if g.cell_m <= cell_size_m]
        return fine_enough[-1] if fine_enough else covering[0]

    def _build(self, bbox: BoundingBox, cell_size_m: float) -> TerrainGrid:
        cols = min(MAX_CELLS_PER_SIDE, max(2, round(bbox.width_m / cell_size_m)))
        rows = min(MAX_CELLS_PER_SIDE, max(2, round(bbox.height_m / cell_size_m)))
        means = self._pick(bbox, cell_size_m).block_means(bbox, rows, cols)
        elevation = [[float(v) for v in row] for row in np.round(means, 2)]
        return TerrainGrid(bbox, rows, cols, elevation, slope_deg(elevation, bbox.width_m / cols))


def dem_available(terrain_dir: Path) -> bool:
    return any((terrain_dir / name / "dem.npy").is_file() for name in ("local", "regional"))

