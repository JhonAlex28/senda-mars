from senda.domain.models.geo import BoundingBox
from senda.domain.models.grid import GridSpec


def test_lonlat_roundtrip():
    spec = GridSpec.from_bbox(BoundingBox(137.37204, -4.8126, 137.40596, -4.7788), 2.0)
    cell = spec.lonlat_to_cell(137.396, -4.785)
    lon, lat = spec.cell_to_lonlat(cell)
    assert spec.lonlat_to_cell(lon, lat) == cell
    assert abs(lon - 137.396) < 1e-4 and abs(lat + 4.785) < 1e-4


def test_from_grid_json_reads_radius():
    spec = GridSpec.from_grid_json({"crs_proj4": "+proj=eqc +R=3396190 +units=m", "origin_xy": [0, 10],
                                    "cell_size_m": 2.0, "shape": [5, 6]})
    assert spec.radius_m == 3396190 and spec.shape == (5, 6)
    assert spec.cell_to_xy((0, 0)) == (1.0, 9.0)


def test_downsample_is_conservative():
    import numpy as np

    from senda.domain.models.terrain import CLASS_NOGO
    from senda.domain.services.terrain_analysis import downsample
    from tests.fixtures.synthetic import synthetic_grid

    g = synthetic_grid()
    g.classes[0, 0] = CLASS_NOGO
    d = downsample(g, 2)
    assert d.spec.cell_size_m == 2 * g.spec.cell_size_m and d.spec.rows == g.spec.rows // 2
    assert d.classes[0, 0] == CLASS_NOGO
    assert np.isclose(d.dem[0, 0], g.dem[:2, :2].mean())
    assert d.risk[0, 0] == g.risk[:2, :2].max()
