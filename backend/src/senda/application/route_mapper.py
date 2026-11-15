"""Traduce el resultado del motor (EvaRoute / RoverRoute, en celdas) al RoutePlan que consume
el frontend (/routes/traverse, /routes/eva, /routes/path)."""
from __future__ import annotations

from senda.domain.models.route import (EvaRoute, Resource, RoutePlan, RoutePoint, RouteProfile,
                                       RouteStop, RoverRoute, TravelMode, Waypoint)
from senda.domain.models.terrain import TerrainGrid


def slope_risk(slope_deg: float, caution_deg: float, max_deg: float) -> float:
    """0 en terreno transitable; crece hasta 1 en el límite infranqueable."""
    if slope_deg <= caution_deg:
        return 0.0
    return min(1.0, (slope_deg - caution_deg) / max(max_deg - caution_deg, 1e-6))


def _build(grid: TerrainGrid, mode: TravelMode, profile: RouteProfile, cells, wp_idx: list[int],
           waypoints: list[Waypoint], step_resource: list[float], step_time_s: list[float],
           cum_dist: list[float], dwell_resource: list[float], resource: tuple[str, str, float],
           caution_deg: float, max_deg: float, return_ok: bool, pnr_index: int | None,
           reserve_min: float | None, reasons: list[str]) -> RoutePlan:
    exact = {idx: w.location for idx, w in zip(wp_idx, waypoints)}
    points: list[RoutePoint] = []
    t_min = used = 0.0
    caution_m = 0.0
    obstacles, in_caution = 0, False
    max_slope = 0.0
    for i, cell in enumerate(cells):
        if i > 0:
            t_min += step_time_s[i - 1] / 60.0
            used += step_resource[i - 1]
        slope = grid.slope(cell)
        max_slope = max(max_slope, slope)
        caution = slope > caution_deg
        if caution and i > 0:
            caution_m += cum_dist[i] - cum_dist[i - 1]
        obstacles += caution and not in_caution
        in_caution = caution
        points.append(RoutePoint(exact.get(i, grid.point_of(cell)), grid.elevation(cell), slope,
                                 cum_dist[i], t_min, used))
    stops: list[RouteStop] = []
    dwell_min_total = dwell_used = 0.0
    for k in range(1, len(waypoints)):
        w = waypoints[k]
        stops.append(RouteStop(wp_idx[k], w.kind, w.ref_id, w.dwell_min, dwell_resource[k]))
        dwell_min_total += w.dwell_min
        dwell_used += dwell_resource[k]
    dist = cum_dist[-1] if cum_dist else 0.0
    exposure = caution_m / dist if dist else 0.0
    safety = 100 * (1 - exposure) * (1 - 0.5 * slope_risk(max_slope, caution_deg, max_deg))
    name, unit, capacity = resource
    return RoutePlan(mode=mode, profile=profile, points=points, stops=stops, distance_m=dist,
                     duration_min=t_min + dwell_min_total, max_slope_deg=max_slope, obstacles=obstacles,
                     safety_pct=round(safety), resource=Resource(name, unit, used + dwell_used, capacity),
                     return_ok=return_ok, pnr_index=pnr_index, reserve_min=reserve_min,
                     infeasible_reasons=reasons, terrain_cell_m=grid.spec.cell_size_m)


def eva_to_plan(grid: TerrainGrid, route: EvaRoute, waypoints: list[Waypoint], kj_per_l: float,
                o2_capacity_l: float, stop_rate_w: float, o2_multiplier: float,
                caution_deg: float, max_deg: float) -> RoutePlan:
    step_l = [e * o2_multiplier / kj_per_l for e in route.step_energy_kj]
    dwell = [0.0] + [stop_rate_w * w.dwell_min * 60.0 / 1000.0 * o2_multiplier / kj_per_l
                     for w in waypoints[1:]]
    reserve_min = min(route.reserve_l) if route.reserve_l else None
    return _build(grid, TravelMode.EVA, route.profile, route.cells, route.waypoint_index, waypoints,
                  step_l, route.step_time_s, route.cum_dist_m, dwell, ("oxygen", "L", o2_capacity_l),
                  caution_deg, max_deg, route.metrics.feasible, route.pnr_index, reserve_min,
                  list(route.infeasible_reasons))


def rover_to_plan(grid: TerrainGrid, route: RoverRoute, waypoints: list[Waypoint], profile: RouteProfile,
                  battery_kwh: float, caution_deg: float, max_deg: float) -> RoutePlan:
    reasons = [] if route.metrics.feasible else ["BATTERY_RESERVE"]
    return _build(grid, TravelMode.ROVER, profile, route.cells, route.waypoint_index, waypoints,
                  route.step_energy_kwh, route.step_time_s, route.cum_dist_m, [0.0] * len(waypoints),
                  ("battery", "kWh", battery_kwh), caution_deg, max_deg, route.metrics.feasible,
                  None, route.reserve_kwh_min, reasons)
