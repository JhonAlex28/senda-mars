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
