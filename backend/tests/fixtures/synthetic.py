"""synthetic_grid(): colina gaussiana + zona prohibida + 3 objetivos (doc §4.1, mock)."""
from __future__ import annotations

import numpy as np

from senda.domain.models.geo import BoundingBox
from senda.domain.models.grid import GridSpec
from senda.domain.models.terrain import CLASS_NOGO, Scale, TerrainGrid
from senda.domain.services.terrain_analysis import classify_slope, derive_risk

BBOX = BoundingBox(137.380, -4.800, 137.384, -4.796)     # ~240 m de lado
CELL_M = 4.0


def synthetic_grid(scale: Scale = Scale.LOCAL, caution: float = 10.0, nogo: float = 20.0,
                   wall: bool = True) -> TerrainGrid:
    spec = GridSpec.from_bbox(BBOX, CELL_M)
    r, c = np.mgrid[0:spec.rows, 0:spec.cols]
    dem = -3700.0 + 25.0 * np.exp(-(((r - spec.rows / 2) ** 2 + (c - spec.cols / 2) ** 2) / (2 * 12.0 ** 2)))
    dem = dem.astype(np.float32)
    classes = classify_slope(dem, CELL_M, caution, nogo)
    if wall:   # muro prohibido vertical con un paso abajo
        classes[: int(spec.rows * 0.7), int(spec.cols * 0.25)] = CLASS_NOGO
    risk = derive_risk(dem, CELL_M, nogo)
    conf = np.ones(spec.shape, dtype=np.float32)
    return TerrainGrid(scale, spec, dem, classes, risk, conf, kind="synthetic")


TARGET_CELLS = {"BASE": (5, 5), "TA": (5, 50), "TB": (50, 50)}
