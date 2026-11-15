"""Tramo rover (R-1…R-3): A* regional con energía eléctrica + campo de drive-back."""
from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np

from senda.domain.models.params import RoverParams
from senda.domain.models.route import TraverseMetrics, TraversePlan
from senda.domain.models.terrain import TerrainGrid
from senda.domain.services.grid_graph import direction_of
from senda.domain.services.pathfinding import grid_astar
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
    search: np.ndarray
    base: Cell
    drive_back_kwh: np.ndarray   # (R, C) kWh para volver a la base

    @classmethod
    def build(cls, terrain: TerrainGrid, params: RoverParams, base: Cell) -> "RoverContext":
        energy, time = rover_step_arrays(terrain, params)
        return cls(terrain=terrain, params=params, energy=energy, time=time,
                   search=rover_search_costs(energy, terrain.risk, params.w_risk),
                   base=base, drive_back_kwh=cost_to_source(energy, base))

    @property
    def h_per_cell(self) -> float:
        return self.terrain.spec.cell_size_m * min_energy_kwh_per_m(self.params)


def plan_traverse(ctx: RoverContext, start: Cell, goal: Cell,
                  battery_used_before_kwh: float = 0.0) -> TraversePlan:
    cells, _ = grid_astar(ctx.search, start, goal, ctx.h_per_cell)
    if not cells:
        raise ValueError(f"no rover path between {start} and {goal}")
    p = ctx.params
    dem = ctx.terrain.dem
    cs = ctx.terrain.spec.cell_size_m
    energy = time = 0.0
    ascent = max_slope = 0.0
    cum_d = [0.0]
    usable = p.battery_kwh * (1.0 - p.battery_reserve_fraction)
    reserve_min = usable - battery_used_before_kwh - float(ctx.drive_back_kwh[start])
    for a, b in zip(cells, cells[1:]):
        k = direction_of(a, b)
        energy += float(ctx.energy[k, a[0], a[1]])
        time += float(ctx.time[k, a[0], a[1]])
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
                              feasible=battery_used_before_kwh + energy <= usable)
    return TraversePlan(cells=cells, metrics=metrics, elevation_m=[float(dem[c]) for c in cells],
                        cum_dist_m=cum_d, reserve_kwh_min=reserve_min)
