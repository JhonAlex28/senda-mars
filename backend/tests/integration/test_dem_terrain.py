"""Terreno real: el DEM del USGS (Mec. A) está bien georreferenciado y cubre la misión."""
import pytest

from senda.adapters.outbound.terrain.npy_terrain import NpyTerrainProvider
from senda.container import get_container
from senda.domain.models.terrain import Scale

TERRAIN_DIR = get_container().settings.data_dir / "terrain"
pytestmark = pytest.mark.skipif(
    not all(NpyTerrainProvider.available(TERRAIN_DIR, s) for s in Scale), reason="DEM data not present")


def test_container_uses_the_real_dem_by_default():
    ctx = get_container().planner
    assert ctx.local().kind == "measured" and ctx.regional().kind == "measured"


def test_dem_matches_the_catalog_elevation_of_every_target():
    """Si la proyección estuviera mal, las elevaciones no coincidirían con el catálogo (MMGIS)."""
    regional = get_container().planner.grid(Scale.REGIONAL)
    diffs = []
    for t in get_container().target_repo.list_all():
        assert regional.contains(t.location), t.id
        diffs.append(abs(regional.elevation(regional.cell_of(t.location)) - t.elevation_m))
    assert sorted(diffs)[len(diffs) // 2] < 2.0
    assert max(diffs) < 15.0


def test_base_and_targets_are_in_passable_rover_terrain():
    regional = get_container().planner.regional()
    for t in get_container().target_repo.list_all():
        assert regional.classes[regional.cell_of(t.location)] != 2, t.id
