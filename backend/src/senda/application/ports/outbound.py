"""Puertos de salida: lo que la aplicación necesita del mundo exterior.
Los adaptadores en senda.adapters.outbound los implementan."""
from __future__ import annotations

from typing import Protocol

from senda.domain.models.environment import EnvironmentSnapshot
from senda.domain.models.geo import BoundingBox
from senda.domain.models.params import MissionParams
from senda.domain.models.target import ScienceTarget
from senda.domain.models.terrain import Scale, TerrainGrid


class TargetRepository(Protocol):
    def list_all(self) -> list[ScienceTarget]: ...
    def get_by_id(self, target_id: str) -> ScienceTarget | None: ...


class EnvironmentRepository(Protocol):
    def get_current(self) -> EnvironmentSnapshot: ...


class TerrainProvider(Protocol):
    """Contrato con Mec. A: una grilla por escala.
    local = boxwork (EVA, classes_human); regional = Zona de Exploración (rover, classes_rover)."""
    def get_grid(self, scale: Scale) -> TerrainGrid: ...
    def site_bounds(self) -> BoundingBox: ...   # área de misión = unión de las grillas


class MissionParamsRepository(Protocol):
    def get(self) -> MissionParams: ...
