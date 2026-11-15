"""Caso de uso: rutas EVA multi-perfil (P-1…P-6) desde/hacia el staging del SEV."""
from __future__ import annotations

from dataclasses import dataclass

from senda.application.planner_context import PlannerContext
from senda.domain.errors import InvalidRequest, NoRouteFound
from senda.domain.models.route import RoutePlan, RouteProfile
from senda.domain.services.eva_planner import Waypoint, plan_eva


@dataclass(frozen=True)
class EvaPlanResult:
    routes: list[RoutePlan]
    waypoints: list[Waypoint]
    staging_id: str


class PlanRoutes:
    def __init__(self, ctx: PlannerContext) -> None:
        self._ctx = ctx

    def execute(self, target_ids: list[str], profiles: list[RouteProfile],
                start_target_id: str | None = None, end_target_id: str | None = None,
                scenario: str = "none") -> EvaPlanResult:
        if not target_ids:
            raise InvalidRequest("target_ids must not be empty")
        if not profiles:
            raise InvalidRequest("profiles must not be empty")
        start = self._ctx.target(start_target_id) if start_target_id else self._ctx.default_staging()
        end = self._ctx.target(end_target_id) if end_target_id else start
        wps = [self._ctx.waypoint(start)]
        wps += [self._ctx.waypoint(self._ctx.target(t)) for t in target_ids if t not in (start.id, end.id)]
        wps.append(self._ctx.waypoint(end))

        params = self._ctx.params
        eva_ctx = self._ctx.eva_context(wps[-1].cell, scenario)
        routes: list[RoutePlan] = []
        for prof in dict.fromkeys(profiles):
            try:
                routes.append(plan_eva(eva_ctx, prof, params.profiles[prof], wps,
                                       params.window.eva_max_duration_min))
            except ValueError as e:
                raise NoRouteFound(f"EVA {prof.value}: {e}") from e
        return EvaPlanResult(routes=routes, waypoints=wps, staging_id=end.id)
