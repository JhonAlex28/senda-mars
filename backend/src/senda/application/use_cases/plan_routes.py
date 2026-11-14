"""Caso de uso: planificar rutas multi-perfil. (PENDIENTE)

Flujo previsto:
  1. Obtener la grilla con TerrainProvider y los objetivos con TargetRepository.
  2. Para cada perfil, definir step_cost (pendiente, riesgo, blindaje...).
  3. Encadenar domain.services.pathfinding.astar entre waypoints.
  4. Calcular O2 y dosis con domain.services.physics.
"""
from __future__ import annotations

from senda.application.ports.outbound import TargetRepository, TerrainProvider
from senda.domain.models.geo import GeoPoint
from senda.domain.models.route import RoutePlan, RouteProfile


class PlanRoutes:
    def __init__(self, targets: TargetRepository, terrain: TerrainProvider) -> None:
        self._targets = targets
        self._terrain = terrain

    def execute(self, origin: GeoPoint, waypoint_ids: list[str],
                profiles: list[RouteProfile]) -> list[RoutePlan]:
        raise NotImplementedError("PlanRoutes aún no implementado")
