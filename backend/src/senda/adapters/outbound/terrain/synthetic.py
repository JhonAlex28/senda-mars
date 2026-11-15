"""Terreno SINTÉTICO (mock) para desarrollar e integrar sin los .npy de Mec. A.

- local: bbox del boxwork; plano ajustado a las elevaciones reales de los objetivos
  (targets_v0.geojson) + crestas tipo boxwork + una mesa empinada (no-go) + arena.
- regional: corredor base → boxwork; rampa entre la elevación supuesta de la base y la
  de T01 + cráteres (bordes no-go para el rover) + una franja de dunas con un paso.

kind = "synthetic": la UI debe indicarlo. NO es dato NASA.
"""
from __future__ import annotations

import math

import numpy as np

from senda.domain.models.geo import BoundingBox, GeoPoint
from senda.domain.models.grid import GridSpec
from senda.domain.models.terrain import CLASS_NOGO, Scale, TerrainGrid
from senda.domain.services.terrain_analysis import classify_slope, derive_risk

LOCAL_BBOX = BoundingBox(137.37204, -4.8126, 137.40596, -4.7788)        # boxwork (grilla local)
REGIONAL_BBOX = BoundingBox(137.34, -4.822, 137.462, -4.578)            # env.json → site (v1)
BASE_ELEV_M = -4500.0                                                    # a verificar con DEM


class SyntheticTerrainProvider:
    def __init__(self, anchors: list[tuple[float, float, float]],
                 local_cell_m: float = 4.0, regional_cell_m: float = 20.0,
                 human_slopes: tuple[float, float] = (10.0, 20.0),
                 rover_slopes: tuple[float, float] = (15.0, 25.0),
                 base_lonlat: tuple[float, float] = (137.42009295, -4.59310427)) -> None:
        """anchors: (lon, lat, elev_m) de los objetivos, para que el DEM sea coherente."""
        # solo los objetivos del boxwork ajustan el DEM local (y el más bajo marca su pie)
        self._anchors = [a for a in anchors if LOCAL_BBOX.contains(GeoPoint(a[0], a[1]))] or anchors
        self._local_cell = local_cell_m
        self._regional_cell = regional_cell_m
        self._human = human_slopes
        self._rover = rover_slopes
        self._base = base_lonlat
        self._cache: dict[Scale, TerrainGrid] = {}

    def get_grid(self, scale: Scale) -> TerrainGrid:
        if scale not in self._cache:
            self._cache[scale] = self._local() if scale == Scale.LOCAL else self._regional()
        return self._cache[scale]

    # ------------------------------------------------------------------
    def _lonlat_mesh(self, spec: GridSpec) -> tuple[np.ndarray, np.ndarray]:
        b = spec.bbox
        lon = b.min_lon + (np.arange(spec.cols) + 0.5) / spec.cols * (b.max_lon - b.min_lon)
        lat = b.max_lat - (np.arange(spec.rows) + 0.5) / spec.rows * (b.max_lat - b.min_lat)
        return np.meshgrid(lon, lat)

    def _local(self) -> TerrainGrid:
        spec = GridSpec.from_bbox(LOCAL_BBOX, self._local_cell)
        lon, lat = self._lonlat_mesh(spec)
        a = np.array([[1.0, x, y] for x, y, _ in self._anchors])
        z = np.array([e for _, _, e in self._anchors])
        coef, *_ = np.linalg.lstsq(a, z, rcond=None)
        dem = coef[0] + coef[1] * lon + coef[2] * lat

        x = (lon - LOCAL_BBOX.min_lon) * 59_000.0
        y = (lat - LOCAL_BBOX.min_lat) * 59_000.0
        # Crestas del boxwork: retícula irregular, ~3 m de relieve cada ~45 m.
        dem += 1.5 * (np.abs(np.sin(x / 45.0 * math.pi)) + np.abs(np.sin((y + 0.3 * x) / 50.0 * math.pi)))
        # Mesa empinada entre T01 y T02 (fuerza un rodeo).
        cx, cy = (137.3895 - LOCAL_BBOX.min_lon) * 59_000.0, (-4.7925 - LOCAL_BBOX.min_lat) * 59_000.0
        r2 = (x - cx) ** 2 + (y - cy) ** 2
        dem += 35.0 * np.exp(-r2 / (2 * 70.0 ** 2))
        dem = dem.astype(np.float32)

        classes = classify_slope(dem, spec.cell_size_m, *self._human)
        risk = derive_risk(dem, spec.cell_size_m, self._human[1])
        # Parche de arena: riesgo alto (no prohibido a pie).
        sx, sy = (137.3855 - LOCAL_BBOX.min_lon) * 59_000.0, (-4.8030 - LOCAL_BBOX.min_lat) * 59_000.0
        sand = (x - sx) ** 2 + (y - sy) ** 2 < 120.0 ** 2
        risk = np.where(sand, np.maximum(risk, 0.7), risk).astype(np.float32)
        conf = np.ones(spec.shape, dtype=np.float32)
        conf[:, : max(1, spec.cols // 20)] = 0.3   # franja oeste "interpolada"
        return TerrainGrid(Scale.LOCAL, spec, dem, classes, risk, conf, kind="synthetic",
                           sources=[{"name": "Synthetic boxwork DEM (fitted to target elevations)",
                                     "kind": "synthetic"}])

    def _regional(self) -> TerrainGrid:
        spec = GridSpec.from_bbox(REGIONAL_BBOX, self._regional_cell)
        lon, lat = self._lonlat_mesh(spec)
        t01 = min(self._anchors, key=lambda a: a[2])          # el más bajo ≈ T01
        base_lat = self._base[1]
        frac = np.clip((base_lat - lat) / (base_lat - t01[1]), -0.2, 1.6)
        dem = BASE_ELEV_M + frac * (t01[2] - BASE_ELEV_M)
        x = (lon - REGIONAL_BBOX.min_lon) * 59_000.0
        y = (lat - REGIONAL_BBOX.min_lat) * 59_000.0
        dem += 4.0 * np.sin(x / 600.0) * np.cos(y / 900.0)
        craters = [(137.410, -4.650, 220.0), (137.402, -4.705, 160.0), (137.398, -4.745, 260.0)]
        for clon, clat, rad in craters:
            cx, cy = (clon - REGIONAL_BBOX.min_lon) * 59_000.0, (clat - REGIONAL_BBOX.min_lat) * 59_000.0
            r = np.hypot(x - cx, y - cy) / rad
            dem += np.where(r < 1.0, -40.0 * (1 - r ** 2), 0.0) + 12.0 * np.exp(-((r - 1.0) / 0.12) ** 2)
        dem = dem.astype(np.float32)

        classes = classify_slope(dem, spec.cell_size_m, *self._rover)
        risk = derive_risk(dem, spec.cell_size_m, self._rover[1])
        # Franja de dunas E-O (no-go para el rover) con un paso al este.
        dune = (np.abs(lat - (-4.68)) < 0.004) & (lon < 137.415)
        classes = np.where(dune, CLASS_NOGO, classes).astype(np.uint8)
        risk = np.where(dune, 1.0, risk).astype(np.float32)
        conf = np.ones(spec.shape, dtype=np.float32)
        return TerrainGrid(Scale.REGIONAL, spec, dem, classes, risk, conf, kind="synthetic",
                           sources=[{"name": "Synthetic corridor DEM (base → boxwork)", "kind": "synthetic"}])
