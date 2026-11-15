"""Grilla de terreno usada por el planificador (una por escala)."""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any

import numpy as np

from senda.domain.models.grid import GridSpec


class Scale(str, Enum):
    LOCAL = "local"         # boxwork, EVA a pie (1–4 m/celda)
    REGIONAL = "regional"   # corredor base -> boxwork, rover (10–20 m/celda)


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
