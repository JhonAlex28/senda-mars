"""Planificación de rutas EVA (P-1…P-6) sobre la grilla local. Pura (numpy, sin I/O)."""
from __future__ import annotations

import math
from dataclasses import dataclass, field

import numpy as np

from senda.domain.models.params import SOL_S, EvaParams, ProfileWeights
from senda.domain.models.route import RouteMetrics, EvaRoute, RouteProfile, Segment, Stop
from senda.domain.models.terrain import TerrainGrid
from senda.domain.services.grid_graph import direction_of
from senda.domain.services.metabolic import (eva_step_arrays, min_energy_kj_per_m,
                                             search_costs)
from senda.domain.services.pathfinding import chain_astar
from senda.domain.services.return_field import cost_to_source
from senda.domain.services.safety_rules import pnr_index, reserve_series

Cell = tuple[int, int]


@dataclass(frozen=True)
class Waypoint:
    id: str
    cell: Cell
    task_min: float = 0.0
    shielding_pct: float = 0.0
    science_points: float = 0.0


@dataclass
class EvaContext:
    """Arrays precalculados para una grilla + escenario. Se cachea en la aplicación."""
    terrain: TerrainGrid
    params: EvaParams
    science: np.ndarray
    energy: np.ndarray            # (8, R, C) kJ
    time: np.ndarray              # (8, R, C) s
    staging: Cell
    return_o2: np.ndarray         # (R, C) L para volver al staging
    return_time_s: np.ndarray     # (R, C) s para volver al staging
    speed_factor: float = 1.0
    _search: dict[tuple[float, float], np.ndarray] = field(default_factory=dict)

    @classmethod
    def build(cls, terrain: TerrainGrid, params: EvaParams, science: np.ndarray,
              staging: Cell, speed_factor: float = 1.0,
              blocked: np.ndarray | None = None) -> "EvaContext":
        energy, time = eva_step_arrays(terrain, params, speed_factor, blocked)
        ret_e = cost_to_source(energy, staging)
        ret_t = cost_to_source(time, staging)
        return cls(terrain=terrain, params=params, science=science, energy=energy, time=time,
                   staging=staging, return_o2=ret_e / params.kj_per_l_o2, return_time_s=ret_t,
                   speed_factor=speed_factor)

    def search(self, w: ProfileWeights) -> np.ndarray:
        key = (w.w_risk, w.w_science)
        if key not in self._search:
            self._search[key] = search_costs(self.energy, self.terrain.risk, self.science,
                                             w.w_risk, w.w_science)
        return self._search[key]

    def h_per_cell(self, w: ProfileWeights) -> float:
        return (self.terrain.spec.cell_size_m * min_energy_kj_per_m(self.params, self.speed_factor)
                * (1.0 - w.w_science))


def plan_eva(ctx: EvaContext, profile: RouteProfile, weights: ProfileWeights,
             waypoints: list[Waypoint], max_duration_min: float) -> EvaRoute:
    """A* encadenado por waypoints con el costo del perfil; métricas con energía real."""
    cells, wp_idx, _ = chain_astar(ctx.search(weights), [w.cell for w in waypoints],
                                   ctx.h_per_cell(weights))
    return evaluate_route(ctx, profile, cells, wp_idx, waypoints, max_duration_min)


def evaluate_route(ctx: EvaContext, profile: RouteProfile, cells: list[Cell],
                   wp_idx: list[int], waypoints: list[Waypoint],
                   max_duration_min: float, o2_multiplier: float = 1.0) -> EvaRoute:
    p = ctx.params
    dem = ctx.terrain.dem
    cs = ctx.terrain.spec.cell_size_m

    step_e: list[float] = []
    step_t: list[float] = []
    cum_d = [0.0]
    ascent = descent = 0.0
    max_slope = 0.0
    for a, b in zip(cells, cells[1:]):
        k = direction_of(a, b)
        step_e.append(float(ctx.energy[k, a[0], a[1]]))
        step_t.append(float(ctx.time[k, a[0], a[1]]))
        d = cs * (math.sqrt(2) if a[0] != b[0] and a[1] != b[1] else 1.0)
        cum_d.append(cum_d[-1] + d)
        dz = float(dem[b] - dem[a])
        ascent += max(dz, 0.0)
        descent += max(-dz, 0.0)
        max_slope = max(max_slope, math.degrees(math.atan(abs(dz) / d)))
    elevation = [float(dem[c]) for c in cells]

    # Paradas: waypoints intermedios con tarea (inicio y fin = staging, sin parada).
    stops: list[Stop] = []
    stop_at: dict[int, Stop] = {}
    for i, (w, idx) in enumerate(zip(waypoints, wp_idx)):
        if 0 < i < len(waypoints) - 1 and w.task_min > 0:
            st = Stop(target_id=w.id, path_index=idx, task_min=w.task_min,
                      energy_kj=p.stop_rate_w * w.task_min * 60.0 / 1000.0,
                      shielding_pct=w.shielding_pct)
            stops.append(st)
            stop_at[idx] = st

    # O2 restante y reserva a lo largo de la ruta.
    o2_left: list[float] = []
    used_kj = 0.0
    for k in range(len(cells)):
        if k > 0:
            used_kj += step_e[k - 1]
        if k in stop_at:
            used_kj += stop_at[k].energy_kj
        o2_left.append(p.o2_capacity_l - used_kj * o2_multiplier / p.kj_per_l_o2)
    ret = [float(ctx.return_o2[c]) for c in cells]
    reserve = reserve_series(o2_left, ret, p.return_safety_factor, o2_multiplier)
    pnr = pnr_index(reserve)

    walk_s = sum(step_t)
    stop_s = sum(s.task_min * 60.0 for s in stops)
    energy_total = sum(step_e) + sum(s.energy_kj for s in stops)
    o2_total = energy_total * o2_multiplier / p.kj_per_l_o2
    rate = p.dose_msv_per_sol / SOL_S
    dose = rate * walk_s + sum(rate * s.task_min * 60.0 * (1 - s.shielding_pct / 100.0) for s in stops)
    time_min = (walk_s + stop_s) / 60.0
    science = sum(w.science_points for i, w in enumerate(waypoints) if 0 < i < len(waypoints) - 1)

    reasons: list[str] = []
    if o2_total > p.o2_capacity_l:
        reasons.append("O2_CAPACITY_EXCEEDED")
    if pnr is not None:
        reasons.append("PNR_ON_ROUTE")
    if time_min > max_duration_min:
        reasons.append("EVA_WINDOW_EXCEEDED")

    segments: list[Segment] = []
    for i in range(len(waypoints) - 1):
        s0, s1 = wp_idx[i], wp_idx[i + 1]
        e = sum(step_e[s0:s1])
        segments.append(Segment(from_id=waypoints[i].id, to_id=waypoints[i + 1].id,
                                start_index=s0, end_index=s1, dist_m=cum_d[s1] - cum_d[s0],
                                energy=e, time_min=sum(step_t[s0:s1]) / 60.0,
                                o2_l=e * o2_multiplier / p.kj_per_l_o2))

    metrics = RouteMetrics(
        dist_m=cum_d[-1], ascent_m=ascent, descent_m=descent, max_slope_deg=max_slope,
        energy_kj=energy_total, o2_l=o2_total, time_min=time_min, walk_time_min=walk_s / 60.0,
        dose_msv=dose, science_score=science,
        o2_margin_at_end=(p.o2_capacity_l - o2_total) / p.o2_capacity_l,
        feasible=not reasons)
    return EvaRoute(profile=profile, cells=cells, metrics=metrics, segments=segments, stops=stops,
                    step_energy_kj=step_e, step_time_s=step_t, elevation_m=elevation,
                    cum_dist_m=cum_d, pnr_index=pnr, infeasible_reasons=reasons,
                    reserve_l=reserve, waypoint_index=list(wp_idx))
