"""DTOs HTTP (Pydantic). Separados de las entidades de dominio."""
from __future__ import annotations

from dataclasses import asdict
from typing import Any

from pydantic import BaseModel

from senda.domain.models.environment import EnvironmentSnapshot
from senda.domain.models.target import ScienceTarget


class RubricOut(BaseModel):
    novelty: int
    habitability: int
    human_only: int
    total: int


class TargetOut(BaseModel):
    id: str
    name: str
    lon: float
    lat: float
    elevation_m: float
    category: str
    description: str
    rubric: RubricOut

    @classmethod
    def from_domain(cls, t: ScienceTarget) -> "TargetOut":
        return cls(
            id=t.id,
            name=t.name,
            lon=t.location.lon,
            lat=t.location.lat,
            elevation_m=t.elevation_m,
            category=t.category,
            description=t.description,
            rubric=RubricOut(
                novelty=t.rubric.novelty,
                habitability=t.rubric.habitability,
                human_only=t.rubric.human_only,
                total=t.rubric.total,
            ),
        )


class EnvironmentOut(BaseModel):
    sol: int
    ls_deg: float
    local_solar_time: str
    pressure_pa: float
    temp_min_c: float
    temp_max_c: float
    details: dict[str, Any]

    @classmethod
    def from_domain(cls, e: EnvironmentSnapshot) -> "EnvironmentOut":
        return cls(**asdict(e))
