"""Puertos de salida: lo que la aplicación necesita del mundo exterior.
Los adaptadores en senda.adapters.outbound los implementan."""
from __future__ import annotations

from collections.abc import Sequence
from typing import Any, Protocol

from senda.application.assistant.conversation import AssistantMessage, Message, ToolSpec
from senda.domain.models.environment import EnvironmentSnapshot
from senda.domain.models.geo import BoundingBox, GeoPoint
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
    def native_grid(self, scale: Scale) -> TerrainGrid: ...   # sin submuestrear (recortes EVA)


class MissionParamsRepository(Protocol):
    def get(self) -> MissionParams: ...


class AssistantModel(Protocol):
    """Un LLM capaz de usar herramientas. Devuelve el siguiente turno del asistente:
    texto y, si quiere más datos, las herramientas que necesita ejecutar.
    Lanza AssistantUnavailable si el proveedor no responde."""

    def next_turn(self, system: str, messages: Sequence[Message],
                  tools: Sequence[ToolSpec]) -> AssistantMessage: ...

    def is_reachable(self) -> bool:
        """Comprobación rápida de que el modelo responde (para avisar en la interfaz)."""
        ...


class KnowledgeBase(Protocol):
    """Documentación del sistema que el asistente puede consultar para explicar."""

    def topics(self) -> dict[str, str]: ...          # tema → título
    def get(self, topic: str) -> str | None: ...


class QuantumOptimizer(Protocol):
    """Elige un subconjunto de objetivos con un optimizador cuántico (o su respaldo).
    La respuesta incluye `mode`, que dice con honestidad qué se ejecutó."""

    def optimize(self, base: GeoPoint, targets: Sequence[ScienceTarget],
                 selected_goal_ids: Sequence[str], speed_kmh: float, qpu_backend: str,
                 layers: int, shots: int, noise_profile: str) -> dict[str, Any]: ...
