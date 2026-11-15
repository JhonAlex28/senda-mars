"""Casos de uso del contrato con el frontend, sobre el motor de Mec. B.

  PlanTraverse  base → puntos de estacionamiento → base, en rover (grilla regional).
  PlanEva       rover → objetivos científicos cercanos → rover, a pie (grilla local).
  PlanPath      ruta genérica por waypoints (replanificación por contingencia y retornos).

Cada uno devuelve las tres alternativas (safe, scientific, fast) para que el usuario compare.
"""
from __future__ import annotations

from dataclasses import replace

import numpy as np

from senda.application.planner_context import PlannerContext, hazard_mask
from senda.application.route_mapper import eva_to_plan, rover_to_plan
from senda.domain.errors import NoRouteFound
from senda.domain.models.geo import GeoPoint
from senda.domain.models.params import RoverParams
from senda.domain.models.route import (Conditions, Hazard, RoutePlan, RouteProfile, StopKind,
                                       TraversePlan, TravelMode, Waypoint)
from senda.domain.models.target import ScienceTarget
from senda.domain.services import eva_planner as eva
from senda.domain.services.parking import order_tour, propose_parkings
from senda.domain.services.pathfinding import chain_astar
from senda.domain.services.rover_planner import plan_rover_chain
from senda.domain.services.terrain_analysis import nogo_mask

DEFAULT_PROFILES = [RouteProfile.SAFE, RouteProfile.SCIENTIFIC, RouteProfile.FAST]
ROVER_RISK = {RouteProfile.SAFE: 3.0, RouteProfile.SCIENTIFIC: 1.0, RouteProfile.FAST: 0.0}


class _Planner:
    def __init__(self, ctx: PlannerContext) -> None:
        self.ctx = ctx

    def resolve_targets(self, ids: list[str]) -> list[ScienceTarget]:
        found = []
        for target_id in ids:
            t = self.ctx.target(target_id)
            if not t.is_base:
                found.append(t)
        return found

    def with_task_time(self, w: Waypoint) -> Waypoint:
        if w.kind is not StopKind.TARGET or w.dwell_min:
            return w
        t = self.ctx.find_target(w.ref_id)
        return target_stop(t) if t else w

    # ---- EVA ---------------------------------------------------------------
    def eva_routes(self, waypoints: list[Waypoint], hazards: list[Hazard], cond: Conditions,
                   profiles: list[RouteProfile] | None) -> list[RoutePlan]:
        p = self.ctx.params
        grid = self.ctx.eva_grid([w.location for w in waypoints])
        cells = [self.ctx.eva_cell(grid, w.location, w.ref_id or w.kind.value) for w in waypoints]
        ectx = self.ctx.eva_ctx(cells[-1], cond.speed_factor, hazards=tuple(hazards), keep=tuple(cells),
                                grid=grid)
        wps = [eva.Waypoint(id=w.ref_id or w.kind.value, cell=c, task_min=w.dwell_min,
                            shielding_pct=self._shielding(w), science_points=self._points(w))
               for w, c in zip(waypoints, cells)]
        out = []
        for prof in profiles or DEFAULT_PROFILES:
            weights = p.profiles[prof]
            try:
                path, idx, _ = chain_astar(ectx.search(weights), [w.cell for w in wps], ectx.h_per_cell(weights))
            except ValueError as e:
                raise NoRouteFound(f"EVA {prof.value}: {e}") from e
            route = eva.evaluate_route(ectx, prof, path, idx, wps, p.window.eva_max_duration_min,
                                       cond.o2_multiplier)
            out.append(eva_to_plan(grid, route, waypoints, p.eva.kj_per_l_o2, p.eva.o2_capacity_l,
                                   p.eva.stop_rate_w, cond.o2_multiplier,
                                   p.eva.slope_caution_deg, p.eva.slope_nogo_deg))
        return out

    # ---- rover -------------------------------------------------------------
    def rover_routes(self, waypoints: list[Waypoint], hazards: list[Hazard], cond: Conditions,
                     profiles: list[RouteProfile] | None) -> list[RoutePlan]:
        p = self.ctx.params
        grid = self.ctx.regional()
        cells = [self.ctx.regional_cell(w.location, w.ref_id or w.kind.value) for w in waypoints]
        rctx = self.ctx.rover_ctx(cells[-1], cond.speed_factor, tuple(hazards), tuple(cells))
        out = []
        for prof in profiles or DEFAULT_PROFILES:
            try:
                route = plan_rover_chain(rctx, cells, 0.0, ROVER_RISK[prof])
            except ValueError as e:
                raise NoRouteFound(f"rover {prof.value}: {e}") from e
            out.append(rover_to_plan(grid, route, waypoints, prof, p.rover.battery_kwh,
                                     p.rover.slope_caution_deg, p.rover.slope_nogo_deg))
        return out

    def _target(self, w: Waypoint) -> ScienceTarget | None:
        return self.ctx.find_target(w.ref_id) if w.kind is StopKind.TARGET else None

    def _shielding(self, w: Waypoint) -> float:
        t = self._target(w)
        return t.shielding_pct if t else 0.0

    def _points(self, w: Waypoint) -> float:
        t = self._target(w)
        return float(t.science_points) if t else 0.0


class PlanTraverse:
    def __init__(self, ctx: PlannerContext) -> None:
        self._p = _Planner(ctx)

    def execute(self, base: GeoPoint, target_ids: list[str], hazards: list[Hazard],
                conditions: Conditions, vehicle_id: str | None = None,
                speed_kmh: float | None = None) -> TraversePlan:
        """`vehicle_id`: solo el SEV presurizado está modelado (doc §0.4); cualquier otro id se
        planifica con los parámetros del SEV. `speed_kmh` escala la velocidad nominal del SEV,
        acotada a su máximo."""
        targets = self._p.resolve_targets(target_ids)
        ctx = self._p.ctx
        conditions = with_cruise_speed(conditions, speed_kmh, ctx.params.rover)
        grid = ctx.regional()
        ctx.regional_cell(base, "base")            # valida que la base esté en el área de misión
        for t in targets:
            if not grid.contains(t.location):
                raise NoRouteFound(f"target {t.id} is outside the rover grid")
        blocked_mask = nogo_mask(grid.classes, ctx.params.rover.nogo_dilation_cells)
        hz = hazard_mask(grid, tuple(hazards))
        if hz is not None:
            blocked_mask = blocked_mask | hz
        blocked = {(int(r), int(c)) for r, c in np.argwhere(blocked_mask)}
        parkings = order_tour(base, propose_parkings(grid, targets, blocked))
        home = Waypoint(base, StopKind.BASE, "base")
        waypoints = [home, *(Waypoint(pk.location, StopKind.PARKING, pk.id) for pk in parkings), home]
        return TraversePlan(parkings, self._p.rover_routes(waypoints, hazards, conditions, None))


class PlanEva:
    def __init__(self, ctx: PlannerContext) -> None:
        self._p = _Planner(ctx)

    def execute(self, rover: GeoPoint, target_ids: list[str], hazards: list[Hazard],
                conditions: Conditions) -> list[RoutePlan]:
        targets = self._p.resolve_targets(target_ids)
        at_rover = Waypoint(rover, StopKind.ROVER, "rover")
        waypoints = [at_rover, *(target_stop(t) for t in targets), at_rover]
        return self._p.eva_routes(waypoints, hazards, conditions, None)


class PlanPath:
    def __init__(self, ctx: PlannerContext) -> None:
        self._p = _Planner(ctx)

    def execute(self, mode: TravelMode, waypoints: list[Waypoint], hazards: list[Hazard],
                conditions: Conditions, profiles: list[RouteProfile] | None = None) -> list[RoutePlan]:
        stops = [self._p.with_task_time(w) for w in waypoints]
        if mode is TravelMode.EVA:
            return self._p.eva_routes(stops, hazards, conditions, profiles)
        return self._p.rover_routes(stops, hazards, conditions, profiles)


def target_stop(t: ScienceTarget) -> Waypoint:
    return Waypoint(t.location, StopKind.TARGET, t.id, t.task_minutes)


def with_cruise_speed(cond: Conditions, speed_kmh: float | None, rover: RoverParams) -> Conditions:
    """Velocidad de crucero pedida por la UI → factor sobre la nominal del SEV (≤ v_max)."""
    if speed_kmh is None or speed_kmh <= 0:
        return cond
    factor = min(speed_kmh, rover.v_max_kmh) / rover.v_nominal_kmh
    return replace(cond, speed_factor=cond.speed_factor * factor)
