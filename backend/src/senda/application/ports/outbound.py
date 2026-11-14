"""Puertos de salida: lo que la aplicación necesita del mundo exterior.
Los adaptadores en senda.adapters.outbound los implementan."""
from __future__ import annotations

from typing import Protocol

from senda.domain.models.environment import EnvironmentSnapshot
from senda.domain.models.target import ScienceTarget
from senda.domain.models.terrain import TerrainGrid


class TargetRepository(Protocol):
    def list_all(self) -> list[ScienceTarget]: ...
    def get_by_id(self, target_id: str) -> ScienceTarget | None: ...


class EnvironmentRepository(Protocol):
    def get_current(self) -> EnvironmentSnapshot: ...


class TerrainProvider(Protocol):
    def get_grid(self) -> TerrainGrid: ...
