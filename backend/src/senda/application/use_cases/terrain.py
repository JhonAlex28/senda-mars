from __future__ import annotations

from senda.application.ports.outbound import TerrainProvider
from senda.domain.models.geo import BoundingBox
from senda.domain.models.terrain import TerrainGrid

MIN_CELL_M = 2.0


class GetTerrain:
    """Grilla de elevación y pendiente para dibujar el mapa (todo el sitio o una ventana)."""

    def __init__(self, terrain: TerrainProvider) -> None:
        self._terrain = terrain

    def execute(self, cell_size_m: float, bbox: BoundingBox | None = None) -> TerrainGrid:
        site = self._terrain.site_bounds()
        window = bbox.intersect(site) if bbox else site
        return self._terrain.get_grid(window, max(cell_size_m, MIN_CELL_M))
