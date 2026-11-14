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
    is_base: bool = False
    task: ScienceTask | None = None

    @property
    def task_minutes(self) -> float:
        return self.task.duration_min if self.task else 0.0
