"""Casos de uso de planificación de rutas.

  PlanTraverse  base → puntos de estacionamiento → base, en rover.
  PlanEva       rover → objetivos científicos cercanos → rover, a pie.
  PlanPath      ruta genérica por waypoints (replanificación por contingencia y retornos).

Cada uno devuelve las tres alternativas (safe, scientific, fast) para que el usuario compare.
"""
from __future__ import annotations

from senda.application.ports.outbound import TargetRepository, TerrainProvider
from senda.domain.errors import OutsideSite, TargetNotFound
from senda.domain.models.geo import BoundingBox, GeoPoint
from senda.domain.models.route import (Conditions, Hazard, ParkingSpot, RoutePlan, RouteProfile,
                                       StopKind, TraversePlan, TravelMode, Waypoint)
from senda.domain.models.target import ScienceTarget
from senda.domain.models.terrain import TerrainGrid
from senda.domain.services.mobility import model_for
from senda.domain.services.parking import propose_parkings
from senda.domain.services.route_planner import hazard_cells, plan_route

ROVER_CELL_M = 16.0
EVA_CELL_M = 3.0
EVA_MARGIN_M = 120.0
DEFAULT_PROFILES = [RouteProfile.SAFE, RouteProfile.SCIENTIFIC, RouteProfile.FAST]


class _Planner:
    """Lógica compartida: elegir la grilla adecuada y calcular cada perfil."""

    def __init__(self, targets: TargetRepository, terrain: TerrainProvider) -> None:
        self._targets = targets
        self._terrain = terrain

    def resolve_targets(self, ids: list[str]) -> list[ScienceTarget]:
        found = []
        for target_id in ids:
            target = self._targets.get_by_id(target_id)
            if target is None:
                raise TargetNotFound(target_id)
            if not target.is_base:
                found.append(target)
        return found

    def grid_for(self, mode: TravelMode, points: list[GeoPoint]) -> TerrainGrid:
        site = self._terrain.site_bounds()
        for p in points:
            if not site.contains(p):
                raise OutsideSite(p.lon, p.lat)
        if mode is TravelMode.ROVER:
            return self._terrain.get_grid(site, ROVER_CELL_M)
        return self._terrain.get_grid(BoundingBox.around(points, EVA_MARGIN_M).intersect(site), EVA_CELL_M)

    def plan_all(self, mode: TravelMode, waypoints: list[Waypoint], hazards: list[Hazard],
                 conditions: Conditions, attractors: list[GeoPoint],
                 profiles: list[RouteProfile] | None = None,
                 grid: TerrainGrid | None = None) -> list[RoutePlan]:
        grid = grid or self.grid_for(mode, [w.location for w in waypoints])
        model = model_for(mode)
        return [plan_route(grid, waypoints, model, profile, hazards, conditions, attractors)
                for profile in profiles or DEFAULT_PROFILES]


class PlanTraverse:
    def __init__(self, targets: TargetRepository, terrain: TerrainProvider) -> None:
        self._planner = _Planner(targets, terrain)

    def execute(self, base: GeoPoint, target_ids: list[str], hazards: list[Hazard],
                conditions: Conditions) -> TraversePlan:
        targets = self._planner.resolve_targets(target_ids)
        grid = self._planner.grid_for(TravelMode.ROVER, [base] + [t.location for t in targets])
        parkings = propose_parkings(grid, targets, hazard_cells(grid, hazards))
        home = Waypoint(base, StopKind.BASE, "base")
        waypoints = [home, *(_parking_stop(p) for p in parkings), home]
        routes = self._planner.plan_all(TravelMode.ROVER, waypoints, hazards, conditions,
                                        [t.location for t in targets], grid=grid)
        return TraversePlan(parkings, routes)


class PlanEva:
    def __init__(self, targets: TargetRepository, terrain: TerrainProvider) -> None:
        self._planner = _Planner(targets, terrain)

    def execute(self, rover: GeoPoint, target_ids: list[str], hazards: list[Hazard],
                conditions: Conditions) -> list[RoutePlan]:
        targets = self._planner.resolve_targets(target_ids)
        at_rover = Waypoint(rover, StopKind.ROVER, "rover")
        waypoints = [at_rover, *(_target_stop(t) for t in targets), at_rover]
        return self._planner.plan_all(TravelMode.EVA, waypoints, hazards, conditions,
                                      [t.location for t in targets])


class PlanPath:
    def __init__(self, targets: TargetRepository, terrain: TerrainProvider) -> None:
        self._targets = targets
        self._planner = _Planner(targets, terrain)

    def execute(self, mode: TravelMode, waypoints: list[Waypoint], hazards: list[Hazard],
                conditions: Conditions, profiles: list[RouteProfile] | None = None) -> list[RoutePlan]:
        stops = [self._with_task_time(w) for w in waypoints]
        attractors = [w.location for w in stops if w.kind is StopKind.TARGET]
        return self._planner.plan_all(mode, stops, hazards, conditions, attractors, profiles)

    def _with_task_time(self, w: Waypoint) -> Waypoint:
        """Los objetivos científicos incluyen la duración de su tarea."""
        if w.kind is not StopKind.TARGET or w.dwell_min:
            return w
        target = self._targets.get_by_id(w.ref_id)
        return _target_stop(target) if target else w


def _parking_stop(p: ParkingSpot) -> Waypoint:
    return Waypoint(p.location, StopKind.PARKING, p.id)


def _target_stop(t: ScienceTarget) -> Waypoint:
    return Waypoint(t.location, StopKind.TARGET, t.id, t.task_minutes)
