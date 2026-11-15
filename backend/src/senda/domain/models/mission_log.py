"""Entidades del registro de la misión: tripulación, planes guardados por sol y procedimientos.

El plan guardado lleva el plan completo tal como lo dibuja la interfaz (`payload`) más un
resumen (`summary`) con las cifras del planificador, para listarlo y que el copiloto lo describa
sin tener que interpretar las rutas."""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any


@dataclass(frozen=True)
class CrewMember:
    id: str            # "EVA-1", "EVA-2"…
    name: str
    role: str
    suit_id: str
    resting_bpm: int
    mass_kg: float


@dataclass(frozen=True)
class Crew:
    team_name: str
    members: tuple[CrewMember, ...]

    def member(self, member_id: str | None) -> CrewMember | None:
        return next((m for m in self.members if m.id == member_id), None)


DEFAULT_CREW = Crew(
    team_name="SENDA CREW",
    members=(
        CrewMember("EVA-1", "Astronaut 1", "CDR", "xEMU-01", 68, 78.0),
        CrewMember("EVA-2", "Astronaut 2", "GEO", "xEMU-02", 64, 68.0),
    ),
)

PLAN_STATUSES = ("planned", "done")


@dataclass(frozen=True)
class SavedPlan:
    id: str
    title: str
    sol: int
    site_id: str
    status: str                      # planned | done
    created_by: str | None           # id del tripulante (CrewMember.id)
    summary: dict[str, Any] = field(default_factory=dict)
    payload: dict[str, Any] = field(default_factory=dict)
    created_at: datetime | None = None
    updated_at: datetime | None = None


@dataclass(frozen=True)
class ProcedureRecord:
    id: str
    site_id: str
    target_id: str
    completed_at: datetime
    crew_member: str | None = None
    plan_id: str | None = None
