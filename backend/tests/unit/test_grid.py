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


def test_downsample_reclassifies_metric_roughness():
    """Rugosidad de 1 m (crestas > 20°) no debe volverse muro de no-go al agregar a 4 m."""
    import numpy as np
    from dataclasses import replace

    from senda.domain.models.terrain import CLASS_NODATA, CLASS_NOGO
    from senda.domain.services.terrain_analysis import classify_slope, downsample, nogo_mask
    from tests.fixtures.synthetic import synthetic_grid

    g = synthetic_grid()
    cs = g.spec.cell_size_m
    rr, cc = np.mgrid[0:g.spec.rows, 0:g.spec.cols]
    bumps = 1.6 * cs * ((cc // 2) % 2)                     # crestas de 2 m, flancos ~39°
    dem = (g.dem + bumps).astype(np.float32)
    dem[:4, :4] = np.nan                                   # bloque completo sin datos
    g = replace(g, dem=dem, classes=classify_slope(dem, cs, 10, 20))
    assert (g.classes == CLASS_NOGO).mean() > 0.5

    worst = downsample(g, 4)
    fixed = downsample(g, 4, 10, 20)
    assert nogo_mask(fixed.classes, 0).mean() < nogo_mask(worst.classes, 0).mean()
    assert fixed.classes[0, 0] == CLASS_NODATA
    assert np.isclose(fixed.risk[1, 1], g.risk[4:8, 4:8].mean())


def test_crop_keeps_georeferencing_and_for_walking_uses_human_thresholds():
    import numpy as np

    from senda.domain.services.terrain_analysis import crop, for_walking, slope_deg
    from tests.fixtures.synthetic import synthetic_grid

    g = synthetic_grid()
    c = crop(g, 5, 25, 7, 30)
    assert c.spec.shape == (20, 23)
    assert c.spec.cell_to_lonlat((0, 0)) == g.spec.cell_to_lonlat((5, 7))
    assert np.array_equal(c.dem, g.dem[5:25, 7:30])
    w = for_walking(c, 10.0, 20.0)
    s = slope_deg(w.dem, w.spec.cell_size_m)
    assert (w.classes[s > 20.0] == 2).all()                 # todo lo empinado para un humano es no-go
    assert (w.classes[c.classes == 2] == 2).all()           # y se conserva el no-go original
    assert float(w.risk.max()) <= 1.0


def test_for_walking_keeps_non_slope_nogo_and_nodata():
    import numpy as np
    from dataclasses import replace

    from senda.domain.models.terrain import CLASS_NODATA, CLASS_NOGO
    from senda.domain.services.terrain_analysis import for_walking
    from tests.fixtures.synthetic import synthetic_grid

    g = synthetic_grid()
    classes = g.classes.copy()
    classes[10, 10] = CLASS_NOGO               # p. ej. duna: no sale de la pendiente
    dem = g.dem.copy()
    dem[30, 30] = np.nan
    w = for_walking(replace(g, classes=classes, dem=dem), 10.0, 20.0)
    assert w.classes[10, 10] == CLASS_NOGO
    assert w.classes[30, 30] == CLASS_NODATA and w.classes[30, 31] == CLASS_NODATA   # borde del NaN
