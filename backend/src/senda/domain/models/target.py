"""Entidad: objetivo científico."""
from __future__ import annotations

from dataclasses import dataclass

from senda.domain.models.geo import GeoPoint


@dataclass(frozen=True)
class Rubric:
    novelty: int
    habitability: int
    human_only: int

    @property
    def total(self) -> int:
        """Puntaje sobre 15."""
        return self.novelty + self.habitability + self.human_only


@dataclass(frozen=True)
class ScienceTarget:
    id: str
    name: str
    location: GeoPoint
    elevation_m: float
    rubric: Rubric
    description: str
    category: str
    # Campos que usa el planificador (targets_v0.geojson, doc §4.3)
    score_s: float = 0.0               # S = total_15 / 15
    eva_duration_min: float = 0.0      # eva_sampling.duration_min
    eva_tool: str = ""
    shielding_pct: float = 0.0         # shielding_reduction_pct
    is_base: bool = False              # staging del SEV (T01)
    is_shelter: bool = False           # refugio alternativo (T08)

    @property
    def science_points(self) -> int:
        return self.rubric.total
