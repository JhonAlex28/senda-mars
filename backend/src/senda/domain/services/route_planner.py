"""Planificador de rutas multi-perfil sobre una grilla de terreno. Sin I/O.

Encadena A* entre waypoints consecutivos. Cada perfil define su costo de paso:
  fast        → solo tiempo de recorrido
  safe        → tiempo muy penalizado por pendiente y por cercanía a peligros
  scientific  → penalización moderada y atracción hacia los objetivos (menor desvío)
"""
from __future__ import annotations

import math
from collections.abc import Iterable

from senda.domain.errors import NoRouteFound
from senda.domain.models.geo import GeoPoint
from senda.domain.models.route import (Conditions, Hazard, Resource, RoutePlan, RoutePoint,
                                       RouteProfile, RouteStop, Waypoint)
from senda.domain.models.terrain import Cell, TerrainGrid
from senda.domain.services.mobility import (CAUTION_SLOPE_DEG, MobilityModel, return_is_safe,
                                            slope_risk)
from senda.domain.services.pathfinding import astar, octile

SAFE_RISK_WEIGHT = 6.0
SAFE_HAZARD_BUFFER_M = 40.0
SAFE_BUFFER_PENALTY = 2.0
SCIENCE_RISK_WEIGHT = 1.5
SCIENCE_ATTRACTION = 0.7       # multiplicador de costo cerca de un objetivo
SCIENCE_RADIUS_CELLS = 5


def cells_within(grid: TerrainGrid, center: GeoPoint, radius_m: float) -> set[Cell]:
    """Celdas cuyo centro está a menos de radius_m del punto."""
    cr, cc = grid.cell_of(center)
    reach = int(radius_m / grid.cell_size_m) + 1
    return {
        (r, c)
        for r in range(max(cr - reach, 0), min(cr + reach + 1, grid.rows))
        for c in range(max(cc - reach, 0), min(cc + reach + 1, grid.cols))
        if grid.point_of((r, c)).distance_to(center) <= radius_m
    }


def hazard_cells(grid: TerrainGrid, hazards: Iterable[Hazard], extra_m: float = 0.0) -> set[Cell]:
    cells: set[Cell] = set()
    for h in hazards:
        cells |= cells_within(grid, h.center, h.radius_m + extra_m)
    return cells


class _StepCost:
    """Costo de pasar de una celda a su vecina según el perfil."""

    def __init__(self, grid: TerrainGrid, model: MobilityModel, profile: RouteProfile,
                 hazards: list[Hazard], conditions: Conditions, attractors: list[GeoPoint],
                 endpoints: set[Cell]) -> None:
        self._grid, self._model, self._profile = grid, model, profile
        self._speed_factor = conditions.speed_factor
        self._endpoints = endpoints
        self._blocked = hazard_cells(grid, hazards) - endpoints
        self._buffer: set[Cell] = set()
        self._attracted: set[Cell] = set()
        if profile is RouteProfile.SAFE:
            self._buffer = hazard_cells(grid, hazards, SAFE_HAZARD_BUFFER_M)
        if profile is RouteProfile.SCIENTIFIC:
            radius = grid.cell_size_m * SCIENCE_RADIUS_CELLS
            for p in attractors:
                self._attracted |= cells_within(grid, p, radius)
        self.min_multiplier = SCIENCE_ATTRACTION if profile is RouteProfile.SCIENTIFIC else 1.0

    def __call__(self, a: Cell, b: Cell) -> float:
        if b in self._blocked:
            return math.inf
        slope = self._grid.slope(b)
        if slope > self._model.max_slope_deg and b not in self._endpoints:
            return math.inf
        diagonal = a[0] != b[0] and a[1] != b[1]
        step_m = self._grid.cell_size_m * (math.sqrt(2) if diagonal else 1.0)
        seconds = step_m / (self._model.speed_m_s(slope) * self._speed_factor)
        if self._profile is RouteProfile.FAST:
            return seconds
        risk = slope_risk(slope, self._model.max_slope_deg)
        if self._profile is RouteProfile.SAFE:
            buffer = SAFE_BUFFER_PENALTY if b in self._buffer else 0.0
            return seconds * (1 + SAFE_RISK_WEIGHT * risk + buffer)
        attraction = SCIENCE_ATTRACTION if b in self._attracted else 1.0
        return seconds * (1 + SCIENCE_RISK_WEIGHT * risk) * attraction


def plan_route(grid: TerrainGrid, waypoints: list[Waypoint], model: MobilityModel,
               profile: RouteProfile, hazards: list[Hazard], conditions: Conditions,
               attractors: list[GeoPoint] | None = None) -> RoutePlan:
    """Ruta que visita los waypoints en orden, con métricas y consumo acumulados."""
    if len(waypoints) < 2:
        raise NoRouteFound("at least two waypoints are needed")
    wp_cells = [grid.cell_of(w.location) for w in waypoints]
    cost = _StepCost(grid, model, profile, hazards, conditions, attractors or [], set(wp_cells))
    seconds_per_cell = grid.cell_size_m / (model.speed_m_s(0) * conditions.speed_factor)
    h_scale = seconds_per_cell * cost.min_multiplier   # heurística admisible

    cells: list[Cell] = [wp_cells[0]]
    arrivals: dict[int, list[Waypoint]] = {}   # índice del punto → waypoints que llegan ahí
    for i in range(1, len(waypoints)):
        leg, total = astar(grid.rows, grid.cols, wp_cells[i - 1], wp_cells[i], cost,
                           lambda x, y: octile(x, y) * h_scale)
        if math.isinf(total):
            raise NoRouteFound(f"{_label(waypoints[i - 1])} → {_label(waypoints[i])}")
        cells.extend(leg[1:])
        arrivals.setdefault(len(cells) - 1, []).append(waypoints[i])

    return _measure(grid, cells, waypoints[0], arrivals, model, profile, conditions)


def _label(w: Waypoint) -> str:
    return w.ref_id or w.kind.value


def _measure(grid: TerrainGrid, cells: list[Cell], start: Waypoint, arrivals: dict[int, list[Waypoint]],
             model: MobilityModel, profile: RouteProfile, conditions: Conditions) -> RoutePlan:
    """Recorre el camino acumulando distancia, tiempo, consumo y exposición a pendiente.
    Los puntos acumulan solo el desplazamiento; el tiempo y consumo de cada tarea van en su parada.
    Varios waypoints pueden caer en la misma celda: cada uno genera su propia parada."""
    points: list[RoutePoint] = []
    stops: list[RouteStop] = []
    dist = minutes = used = caution_m = 0.0
    dwell_min = dwell_used = 0.0
    obstacles, in_caution = 0, False

    for i, cell in enumerate(cells):
        arriving = arrivals.get(i, [])
        # Coordenada exacta en el inicio y en las paradas; centro de celda en el resto
        loc = arriving[-1].location if arriving else start.location if i == 0 else grid.point_of(cell)
        elev, slope = grid.elevation(cell), grid.slope(cell)
        if points:
            prev = points[-1]
            step = prev.location.distance_to(loc)
            seconds = step / (model.speed_m_s(slope) * conditions.speed_factor)
            dist += step
            minutes += seconds / 60
            used += model.step_resource(step, elev - prev.elevation_m, seconds, conditions)
            if slope > CAUTION_SLOPE_DEG:
                caution_m += step
        caution = slope > CAUTION_SLOPE_DEG
        obstacles += caution and not in_caution
        in_caution = caution
        points.append(RoutePoint(loc, elev, slope, dist, minutes, used))
        for waypoint in arriving:
            task_used = model.dwell_resource(waypoint.dwell_min, conditions)
            stops.append(RouteStop(i, waypoint.kind, waypoint.ref_id, waypoint.dwell_min, task_used))
            dwell_min += waypoint.dwell_min
            dwell_used += task_used

    max_slope = max(p.slope_deg for p in points)
    exposure = caution_m / dist if dist else 0.0
    safety = 100 * (1 - exposure) * (1 - 0.5 * slope_risk(max_slope, model.max_slope_deg))
    total_used = used + dwell_used
    resource = Resource(model.resource_name, model.resource_unit, total_used, model.capacity)
    return RoutePlan(model.mode, profile, points, stops, dist, minutes + dwell_min, max_slope,
                     obstacles, round(safety), resource, return_is_safe(total_used, model.capacity))
