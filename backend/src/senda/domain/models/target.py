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
class ScienceTask:
    """Tarea científica planificada en el objetivo (lo que hace el astronauta al llegar)."""
    tool: str
    duration_min: float
    protocol: str


@dataclass(frozen=True)
class ScienceTarget:
    id: str
    name: str
    location: GeoPoint
    elevation_m: float
    rubric: Rubric
    description: str
    category: str
    is_base: bool = False              # staging del SEV (T01)
    task: ScienceTask | None = None    # eva_sampling
    # Campos que usa el planificador (targets_v0.geojson, doc §4.3)
    score_s: float = 0.0               # S = total_15 / 15
    shielding_pct: float = 0.0         # shielding_reduction_pct
    is_shelter: bool = False           # refugio alternativo (T08)

    @property
    def task_minutes(self) -> float:
        return self.task.duration_min if self.task else 0.0

    @property
    def eva_duration_min(self) -> float:
        return self.task_minutes

    @property
    def science_points(self) -> int:
        return self.rubric.total
