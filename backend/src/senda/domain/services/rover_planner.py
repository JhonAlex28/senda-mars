"""Tramo rover (R-1…R-3): A* regional con energía eléctrica + campo de drive-back."""
from __future__ import annotations

import math
from dataclasses import dataclass, field

import numpy as np

from senda.domain.models.params import RoverParams
from senda.domain.models.route import RoverRoute, TraverseMetrics
from senda.domain.models.terrain import TerrainGrid
from senda.domain.services.grid_graph import direction_of
from senda.domain.services.pathfinding import chain_astar
from senda.domain.services.return_field import cost_to_source
from senda.domain.services.rover_energy import (min_energy_kwh_per_m, rover_search_costs,
                                                rover_step_arrays)

Cell = tuple[int, int]


@dataclass
class RoverContext:
    terrain: TerrainGrid
    params: RoverParams
    energy: np.ndarray        # (8, R, C) kWh
    time: np.ndarray          # (8, R, C) s
    base: Cell
    drive_back_kwh: np.ndarray   # (R, C) kWh para volver a la base
    speed_factor: float = 1.0
    _search: dict[float, np.ndarray] = field(default_factory=dict)

    @classmethod
    def build(cls, terrain: TerrainGrid, params: RoverParams, base: Cell,
              speed_factor: float = 1.0, blocked: np.ndarray | None = None) -> "RoverContext":
        energy, time = rover_step_arrays(terrain, params, speed_factor, blocked)
        return cls(terrain=terrain, params=params, energy=energy, time=time, base=base,
                   drive_back_kwh=cost_to_source(energy, base), speed_factor=speed_factor)

    def search(self, w_risk: float | None = None) -> np.ndarray:
        w = self.params.w_risk if w_risk is None else w_risk
        if w not in self._search:
            self._search[w] = rover_search_costs(self.energy, self.terrain.risk, w)
        return self._search[w]

    @property
    def h_per_cell(self) -> float:
        return self.terrain.spec.cell_size_m * min_energy_kwh_per_m(self.params, self.speed_factor)


def plan_traverse(ctx: RoverContext, start: Cell, goal: Cell,
                  battery_used_before_kwh: float = 0.0, w_risk: float | None = None) -> RoverRoute:
    return plan_rover_chain(ctx, [start, goal], battery_used_before_kwh, w_risk)


def plan_rover_chain(ctx: RoverContext, waypoints: list[Cell], battery_used_before_kwh: float = 0.0,
                     w_risk: float | None = None) -> RoverRoute:
    try:
        cells, wp_idx, _ = chain_astar(ctx.search(w_risk), waypoints, ctx.h_per_cell)
    except ValueError as e:
        raise ValueError(f"no rover path: {e}") from e
    return evaluate_rover(ctx, cells, wp_idx, battery_used_before_kwh)


def evaluate_rover(ctx: RoverContext, cells: list[Cell], wp_idx: list[int],
                   battery_used_before_kwh: float = 0.0) -> RoverRoute:
    p = ctx.params
    dem = ctx.terrain.dem
    cs = ctx.terrain.spec.cell_size_m
    energy = time = 0.0
    ascent = max_slope = 0.0
    cum_d = [0.0]
    step_e: list[float] = []
    step_t: list[float] = []
    usable = p.battery_kwh * (1.0 - p.battery_reserve_fraction)
    reserve_min = usable - battery_used_before_kwh - float(ctx.drive_back_kwh[cells[0]])
    for a, b in zip(cells, cells[1:]):
        k = direction_of(a, b)
        e = float(ctx.energy[k, a[0], a[1]])
        t = float(ctx.time[k, a[0], a[1]])
        step_e.append(e)
        step_t.append(t)
        energy += e
        time += t
        d = cs * (math.sqrt(2) if a[0] != b[0] and a[1] != b[1] else 1.0)
        cum_d.append(cum_d[-1] + d)
        dz = float(dem[b] - dem[a])
        ascent += max(dz, 0.0)
        max_slope = max(max_slope, math.degrees(math.atan(abs(dz) / d)))
        reserve_min = min(reserve_min,
                          usable - battery_used_before_kwh - energy - float(ctx.drive_back_kwh[b]))
    used_pct = 100.0 * (battery_used_before_kwh + energy) / p.battery_kwh
    metrics = TraverseMetrics(dist_m=cum_d[-1], ascent_m=ascent, max_slope_deg=max_slope,
                              energy_kwh=energy, battery_used_pct=used_pct, time_min=time / 60.0,
                              feasible=battery_used_before_kwh + energy <= usable and reserve_min >= 0)
    return RoverRoute(cells=cells, metrics=metrics, elevation_m=[float(dem[c]) for c in cells],
                      cum_dist_m=cum_d, reserve_kwh_min=reserve_min, step_energy_kwh=step_e,
                      step_time_s=step_t, waypoint_index=list(wp_idx))
