"""Terreno real de Mec. A: data/terrain/<scale>/{grid.json, dem.npy, classes_*.npy, risk.npy,
confidence.npy} (doc §4.2). Se carga una vez y se cachea.

Solo `grid.json` y `dem.npy` son obligatorios: si faltan clases/riesgo/confianza se derivan
del DEM con los umbrales del agente de esa escala (humano en local, rover en regional).
"""
from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np

from senda.domain.models.geo import BoundingBox
from senda.domain.models.grid import GridSpec
from senda.domain.models.terrain import Scale, TerrainGrid
from senda.domain.services.terrain_analysis import (classify_slope, default_confidence, derive_risk,
                                                    downsample)

CLASS_FILE = {Scale.LOCAL: "classes_human.npy", Scale.REGIONAL: "classes_rover.npy"}


class NpyTerrainProvider:
    def __init__(self, root: Path, human_slopes: tuple[float, float],
                 rover_slopes: tuple[float, float]) -> None:
        self._root = root
        self._slopes = {Scale.LOCAL: human_slopes, Scale.REGIONAL: rover_slopes}
        self._cache: dict[Scale, TerrainGrid] = {}

    @staticmethod
    def available(root: Path, scale: Scale) -> bool:
        d = root / scale.value
        return (d / "grid.json").exists() and (d / "dem.npy").exists()

    def get_grid(self, scale: Scale) -> TerrainGrid:
        if scale not in self._cache:
            self._cache[scale] = self._load(scale)
        return self._cache[scale]

    def _load(self, scale: Scale) -> TerrainGrid:
        d = self._root / scale.value
        meta = json.loads((d / "grid.json").read_text(encoding="utf-8"))
        spec = GridSpec.from_grid_json(meta)
        dem = np.load(d / "dem.npy").astype(np.float32)
        caution, nogo = self._slopes[scale]

        def opt(name: str, fallback):
            p = d / name
            return np.load(p) if p.exists() else fallback()

        classes = opt(CLASS_FILE[scale], lambda: classify_slope(dem, spec.cell_size_m, caution, nogo))
        if scale == Scale.LOCAL and not (d / CLASS_FILE[scale]).exists() and (d / "classes.npy").exists():
            classes = np.load(d / "classes.npy")
        risk = opt("risk.npy", lambda: derive_risk(dem, spec.cell_size_m, nogo))
        conf = opt("confidence.npy", lambda: default_confidence(dem))
        return TerrainGrid(scale=scale, spec=spec, dem=dem, classes=classes.astype(np.uint8),
                           risk=risk.astype(np.float32), confidence=conf.astype(np.float32),
                           sources=meta.get("sources", []), kind="measured")


class CompositeTerrainProvider:
    """Usa el .npy real si existe para esa escala; si no, el sintético.
    Si la grilla supera `max_cells`, la submuestrea para planificar (< 5 s, doc §6.3),
    reclasificando la pendiente con los umbrales de la escala (`slopes`) si se dan."""

    def __init__(self, real: NpyTerrainProvider, fallback, root: Path,
                 max_cells: int = 300_000,
                 slopes: dict[Scale, tuple[float, float]] | None = None) -> None:
        self._real = real
        self._slopes = slopes or {}
        self._fallback = fallback
        self._root = root
        self._max_cells = max_cells
        self._cache: dict[Scale, TerrainGrid] = {}

    def get_grid(self, scale: Scale) -> TerrainGrid:
        if scale not in self._cache:
            src = (self._real if NpyTerrainProvider.available(self._root, scale) else self._fallback)
            grid = src.get_grid(scale)
            n = grid.spec.rows * grid.spec.cols
            factor = math.ceil(math.sqrt(n / self._max_cells)) if n > self._max_cells else 1
            caution, nogo = self._slopes.get(scale, (None, None))
            self._cache[scale] = downsample(grid, factor, caution, nogo)
        return self._cache[scale]

    def site_bounds(self) -> BoundingBox:
        """Área de misión = unión de los bboxes de todas las escalas (doc §0.1)."""
        boxes = [self.get_grid(s).spec.bbox for s in Scale]
        return BoundingBox(min(b.min_lon for b in boxes), min(b.min_lat for b in boxes),
                           max(b.max_lon for b in boxes), max(b.max_lat for b in boxes))
