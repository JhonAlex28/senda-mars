"""Tramos internos de la misión (los usa PlanMission / POST /mission/plan).

  PlanEvaRoutes  staging (SEV) → objetivos → staging, 3 perfiles (P-1…P-6)
  PlanRoverLeg   un tramo en rover presurizado en la grilla regional (R-1…R-3)
"""
from __future__ import annotations

from dataclasses import dataclass

from senda.application.planner_context import PlannerContext
from senda.domain.errors import InvalidRequest, NoRouteFound
from senda.domain.models.geo import GeoPoint
from senda.domain.models.route import EvaRoute, RouteProfile, RoverRoute
from senda.domain.services.eva_planner import Waypoint, plan_eva
from senda.domain.services.rover_planner import plan_traverse


@dataclass(frozen=True)
class EvaPlanResult:
    routes: list[EvaRoute]
    waypoints: list[Waypoint]
    staging_id: str


class PlanEvaRoutes:
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
        routes: list[EvaRoute] = []
        for prof in dict.fromkeys(profiles):
            try:
                routes.append(plan_eva(eva_ctx, prof, params.profiles[prof], wps,
                                       params.window.eva_max_duration_min))
            except ValueError as e:
                raise NoRouteFound(f"EVA {prof.value}: {e}") from e
        return EvaPlanResult(routes=routes, waypoints=wps, staging_id=end.id)


class PlanRoverLeg:
    def __init__(self, ctx: PlannerContext) -> None:
        self._ctx = ctx

    def execute(self, from_lonlat: tuple[float, float], to_lonlat: tuple[float, float],
                battery_used_before_kwh: float = 0.0) -> RoverRoute:
        rc = self._ctx.rover_context()
        a = self._ctx.regional_cell(GeoPoint(*from_lonlat), "traverse origin")
        b = self._ctx.regional_cell(GeoPoint(*to_lonlat), "traverse destination")
        try:
            return plan_traverse(rc, a, b, battery_used_before_kwh)
        except ValueError as e:
            raise NoRouteFound(str(e)) from e
