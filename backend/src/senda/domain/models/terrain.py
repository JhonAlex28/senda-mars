"""Grilla de terreno usada por el planificador (una por escala).
Fila 0 = borde norte; columna 0 = borde oeste (ver GridSpec)."""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any

import numpy as np

from senda.domain.models.geo import BoundingBox, GeoPoint
from senda.domain.models.grid import GridSpec

Cell = tuple[int, int]


class Scale(str, Enum):
    LOCAL = "local"         # boxwork, EVA a pie (1–4 m/celda)
    REGIONAL = "regional"   # Zona de Exploración / corredor desde la base, rover (10–200 m/celda)


# Clases de terreno (uint8), iguales para humano y rover; cambian los umbrales.
CLASS_OK = 0
CLASS_CAUTION = 1
CLASS_NOGO = 2
CLASS_NODATA = 255


@dataclass(frozen=True, eq=False)
class TerrainGrid:
    """Arrays alineados a `spec` (shape = spec.shape).

    dem:        float32, m (NaN = sin datos)
    classes:    uint8, 0/1/2/255 para el agente de esta escala
                (local -> classes_human, regional -> classes_rover)
    risk:       float32 [0, 1]
    confidence: float32 [0, 1]
    """
    scale: Scale
    spec: GridSpec
    dem: np.ndarray
    classes: np.ndarray
    risk: np.ndarray
    confidence: np.ndarray
    sources: list[dict[str, Any]] = field(default_factory=list)
    kind: str = "measured"   # "measured" | "synthetic"

    def __post_init__(self) -> None:
        for name in ("dem", "classes", "risk", "confidence"):
            arr = getattr(self, name)
            if arr.shape != self.spec.shape:
                raise ValueError(f"{name}.shape {arr.shape} != grid {self.spec.shape}")

    # ---- ayudas por punto (usadas por parking.py y los mappers) ------------
    @property
    def rows(self) -> int:
        return self.spec.rows

    @property
    def cols(self) -> int:
        return self.spec.cols

    @property
    def cell_size_m(self) -> float:
        return self.spec.cell_size_m

    @property
    def bbox(self) -> BoundingBox:
        return self.spec.bbox

    @property
    def slope_deg(self) -> np.ndarray:
        cached = self.__dict__.get("_slope")
        if cached is None:
            from senda.domain.services.terrain_analysis import slope_deg
            cached = np.nan_to_num(slope_deg(self.dem, self.spec.cell_size_m), nan=90.0)
            object.__setattr__(self, "_slope", cached)
        return cached

    def cell_of(self, p: GeoPoint) -> Cell:
        """Celda que contiene el punto (recortada al borde si cae fuera)."""
        r, c = self.spec.lonlat_to_cell(p.lon, p.lat)
        return min(max(r, 0), self.rows - 1), min(max(c, 0), self.cols - 1)

    def point_of(self, cell: Cell) -> GeoPoint:
        return self.spec.cell_to_geopoint(cell)

    def contains(self, p: GeoPoint) -> bool:
        return self.spec.contains(self.spec.lonlat_to_cell(p.lon, p.lat))

    def elevation(self, cell: Cell) -> float:
        return float(self.dem[cell])

    def slope(self, cell: Cell) -> float:
        return float(self.slope_deg[cell])
