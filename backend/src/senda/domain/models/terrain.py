"""Grilla de terreno usada por el planificador."""
from __future__ import annotations

from dataclasses import dataclass

from senda.domain.models.geo import BoundingBox


@dataclass(frozen=True)
class TerrainGrid:
    bbox: BoundingBox
    rows: int
    cols: int
    elevation_m: list[list[float]]
    slope_deg: list[list[float]]
