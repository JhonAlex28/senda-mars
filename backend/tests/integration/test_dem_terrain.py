"""Terreno real: el DEM del USGS está bien georreferenciado y se remuestrea por bloques."""
import numpy as np
import pytest

from senda.adapters.outbound.terrain.npy_dem import NpyDemTerrainProvider, dem_available
from senda.container import get_container
from senda.domain.models.geo import BoundingBox

TERRAIN_DIR = get_container().settings.data_dir / "terrain"
pytestmark = pytest.mark.skipif(not dem_available(TERRAIN_DIR), reason="DEM data not present")


def _provider() -> NpyDemTerrainProvider:
    return NpyDemTerrainProvider(get_container().environment_repo.site_bounds(), TERRAIN_DIR)


def test_container_uses_the_real_dem_by_default():
    assert isinstance(get_container().terrain, NpyDemTerrainProvider)


def test_dem_matches_the_catalog_elevation_of_every_target():
    """Si la proyección estuviera mal, las elevaciones no coincidirían con el catálogo."""
    terrain = _provider()
    diffs = []
    for target in get_container().target_repo.list_all():
        grid = terrain.get_grid(BoundingBox.around([target.location], 30), 3)
        diffs.append(abs(grid.elevation(grid.cell_of(target.location)) - target.elevation_m))
    # La mayoría coincide a ~1 m. T01 (coordenadas redondeadas a 3 decimales, dentro de un
    # cráter) y T08 (borde de una cresta) difieren hasta ~11 m por la precisión del catálogo.
    assert float(np.median(diffs)) < 2.0
    assert max(diffs) < 15.0


def test_picks_the_finest_grid_that_is_not_wasted():
    terrain, site = _provider(), _provider().site_bounds()
    assert terrain.source_for(site, 16) == "regional"   # rover: 10 m alcanza
    assert terrain.source_for(site, 3) == "local"       # EVA: hace falta el de 1 m


def test_coarse_cells_average_the_dem_block():
    terrain, site = _provider(), _provider().site_bounds()
    coarse = np.array(terrain.get_grid(site, 50).elevation_m)
    fine = np.array(terrain.get_grid(site, 10).elevation_m)
    # La media del sitio no cambia con la resolución (no se pierden ni inventan relieves)
    assert abs(coarse.mean() - fine.mean()) < 1.0
    assert -3920 < coarse.min() and coarse.max() < -3400
