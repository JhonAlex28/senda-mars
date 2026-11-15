"""Caso de uso: simulación de la EVA con escenarios (S-3…S-6)."""
from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np

from senda.application.planner_context import PlannerContext
from senda.domain.errors import InvalidRequest, NoRouteFound
from senda.domain.models.geo import GeoPoint
from senda.domain.models.route import EvaRoute, RouteProfile
from senda.domain.models.terrain import TerrainGrid
from senda.domain.services.eva_planner import Waypoint, evaluate_route
from senda.domain.services.pathfinding import chain_astar
from senda.domain.services.scenarios import SCENARIOS, effect_of
from senda.domain.services.simulation import SimulationResult, simulate_eva

Cell = tuple[int, int]
BLOCK_AHEAD_M = 30.0
BLOCK_RADIUS_M = 10.0


@dataclass(frozen=True)
class StopInput:
    target_id: str
    path_index: int


@dataclass(frozen=True)
class SimulationOutput:
    result: SimulationResult
    plan: EvaRoute                     # ruta que se simuló (tras replanificar si hubo)
    replanned: EvaRoute | None
    staging_id: str
    grid: TerrainGrid                  # grilla de la EVA simulada


class SimulateEva:
    def __init__(self, ctx: PlannerContext) -> None:
        self._ctx = ctx

    def execute(self, profile: RouteProfile, cells: list[Cell], stops: list[StopInput],
                scenario: str = "none", scenario_at_index: int = 0,
                path: list[tuple[float, float]] | None = None) -> SimulationOutput:
        """`path` ([lon, lat] de la ruta, como lo devuelve el planner) ubica la EVA en su grilla
        (local o recorte regional); sin `path`, las celdas se interpretan en la grilla local."""
        if path:
            grid = self._ctx.eva_grid([GeoPoint(lon, lat) for lon, lat in path])
            cells = [grid.spec.lonlat_to_cell(lon, lat) for lon, lat in path]
        else:
            grid = self._ctx.local()
        if scenario not in SCENARIOS:
            raise InvalidRequest(f"Unknown scenario '{scenario}'")
        if len(cells) < 2:
            raise InvalidRequest("route must have at least 2 cells")
        for a, b in zip(cells, cells[1:]):
            if max(abs(a[0] - b[0]), abs(a[1] - b[1])) != 1:
                raise InvalidRequest("route cells must be 8-connected neighbours")
        if not all(grid.spec.contains(c) for c in cells):
            raise InvalidRequest("route cells outside the EVA grid")
        at = max(0, min(scenario_at_index, len(cells) - 1))

        params = self._ctx.params
        staging_id = "rover"
        staging_cell = cells[-1]
        wps, wp_idx = self._waypoints(cells, stops, staging_id)
        nominal = self._ctx.eva_context(staging_cell, grid=grid)
        plan = evaluate_route(nominal, profile, cells, wp_idx, wps, params.window.eva_max_duration_min)

        eff = effect_of(scenario, params.eva)
        replanned: EvaRoute | None = None
        if eff.blocked_path:
            scenario_ctx, replanned = self._replan_blocked(grid, profile, cells, wps, wp_idx, at,
                                                           staging_cell)
            plan = replanned
            eff = effect_of("none", params.eva)
        else:
            scenario_ctx = self._ctx.eva_context(staging_cell, scenario, grid=grid)

        result = simulate_eva(nominal, scenario_ctx, eff, plan, at,
                              params.profiles[RouteProfile.SAFE],
                              params.window.eva_max_duration_min, staging_id,
                              self._ctx.shelters(scenario_ctx, scenario) if eff.sep_active else None)
        return SimulationOutput(result=result, plan=plan, replanned=replanned, staging_id=staging_id,
                                grid=grid)

    # ------------------------------------------------------------------
    def _waypoints(self, cells: list[Cell], stops: list[StopInput],
                   staging_id: str) -> tuple[list[Waypoint], list[int]]:
        wps = [Waypoint(id=staging_id, cell=cells[0])]
        idx = [0]
        for s in sorted(stops, key=lambda s: s.path_index):
            if not 0 < s.path_index < len(cells) - 1:
                raise InvalidRequest(f"stop {s.target_id} path_index out of range")
            t = self._ctx.target(s.target_id)
            wps.append(Waypoint(id=t.id, cell=cells[s.path_index], task_min=t.eva_duration_min,
                                shielding_pct=t.shielding_pct, science_points=t.science_points))
            idx.append(s.path_index)
        wps.append(Waypoint(id=staging_id, cell=cells[-1]))
        idx.append(len(cells) - 1)
        return wps, idx

    def _replan_blocked(self, grid: TerrainGrid, profile: RouteProfile, cells: list[Cell],
                        wps: list[Waypoint], wp_idx: list[int], at: int, staging_cell: Cell):
        cs = grid.spec.cell_size_m
        center = cells[min(len(cells) - 2, at + max(1, int(BLOCK_AHEAD_M / cs)))]
        rad = max(1, int(math.ceil(BLOCK_RADIUS_M / cs)))
        rr, cc = np.ogrid[0:grid.spec.rows, 0:grid.spec.cols]
        blocked = (rr - center[0]) ** 2 + (cc - center[1]) ** 2 <= rad ** 2
        blocked[cells[at]] = False
        blocked[staging_cell] = False
        ctx = self._ctx.eva_context(staging_cell, "blocked_path", blocked=blocked, grid=grid)

        remaining = [w for w, i in zip(wps, wp_idx) if i > at and not blocked[w.cell]]
        if not remaining or remaining[-1].cell != staging_cell:
            remaining.append(wps[-1])
        here = Waypoint(id="here", cell=cells[at])
        weights = self._ctx.params.profiles[profile]
        try:
            new_cells, new_idx, _ = chain_astar(ctx.search(weights), [here.cell] + [w.cell for w in remaining],
                                                ctx.h_per_cell(weights))
        except ValueError as e:
            raise NoRouteFound(f"replanning after blocked path: {e}") from e
        full = cells[:at + 1] + new_cells[1:]
        kept = [(w, i) for w, i in zip(wps, wp_idx) if i <= at]
        all_wps = [w for w, _ in kept] + remaining
        all_idx = [i for _, i in kept] + [at + i for i in new_idx[1:]]
        plan = evaluate_route(ctx, profile, full, all_idx, all_wps,
                              self._ctx.params.window.eva_max_duration_min)
        return ctx, plan
