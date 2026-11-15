"""Caso de uso: grilla de elevación y pendiente para dibujar el mapa.

Se sirve desde los mismos rásteres que usa el planificador (contrato con Mec. A):
la escala local si la ventana cabe en el boxwork y se pide detalle; si no, la regional.
"""
from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np

from senda.application.planner_context import PlannerContext
from senda.domain.errors import InvalidRequest
from senda.domain.models.geo import BoundingBox
from senda.domain.models.terrain import TerrainGrid

MIN_CELL_M = 2.0
MAX_CELLS = 400_000


@dataclass(frozen=True)
class TerrainView:
    bbox: BoundingBox
    rows: int
    cols: int
    cell_size_m: float
    elevation_m: np.ndarray   # (rows, cols), norte → sur
    slope_deg: np.ndarray
    scale: str
    kind: str


def _inside(inner: BoundingBox, outer: BoundingBox) -> bool:
    return (inner.min_lon >= outer.min_lon and inner.max_lon <= outer.max_lon
            and inner.min_lat >= outer.min_lat and inner.max_lat <= outer.max_lat)


class GetTerrain:
    def __init__(self, ctx: PlannerContext) -> None:
        self._ctx = ctx

    def execute(self, cell_size_m: float, bbox: BoundingBox | None = None) -> TerrainView:
        cell_size_m = max(cell_size_m, MIN_CELL_M)
        local, regional = self._ctx.local(), self._ctx.regional()
        site = self._ctx.site_bounds()
        window = bbox.intersect(site) if bbox else site
        if window.min_lon >= window.max_lon or window.min_lat >= window.max_lat:
            raise InvalidRequest("bbox does not overlap the mission area")
        use_local = _inside(window, local.bbox) and cell_size_m < regional.cell_size_m
        grid: TerrainGrid = local if use_local else regional
        return _crop(grid, window.intersect(grid.bbox), cell_size_m)


def _crop(grid: TerrainGrid, window: BoundingBox, cell_size_m: float) -> TerrainView:
    spec = grid.spec
    r0, c0 = spec.lonlat_to_cell(window.min_lon, window.max_lat)
    r1, c1 = spec.lonlat_to_cell(window.max_lon, window.min_lat)
    r0, c0 = max(r0, 0), max(c0, 0)
    r1, c1 = min(r1, spec.rows - 1), min(c1, spec.cols - 1)
    dem = grid.dem[r0:r1 + 1, c0:c1 + 1]
    slope = grid.slope_deg[r0:r1 + 1, c0:c1 + 1]
    step = max(1, int(round(cell_size_m / spec.cell_size_m)))
    while math.ceil(dem.shape[0] / step) * math.ceil(dem.shape[1] / step) > MAX_CELLS:
        step += 1
    dem, slope = dem[::step, ::step], slope[::step, ::step]
    nw = spec.cell_to_lonlat((r0, c0))
    se = spec.cell_to_lonlat((r1, c1))
    half = spec.cell_size_m / 2 / spec.radius_m * 180 / math.pi
    bbox = BoundingBox(nw[0] - half, se[1] - half, se[0] + half, nw[1] + half)
    fill = float(np.nanmin(dem)) if np.isfinite(dem).any() else 0.0
    return TerrainView(bbox=bbox, rows=dem.shape[0], cols=dem.shape[1],
                       cell_size_m=spec.cell_size_m * step,
                       elevation_m=np.nan_to_num(dem, nan=fill), slope_deg=np.nan_to_num(slope, nan=90.0),
                       scale=grid.scale.value, kind=grid.kind)

